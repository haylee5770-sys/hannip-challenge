// 날짜 아래 두 줄 (2026-11-20)
//  - 오늘의 운세(재미용): 띠·별자리 + 날짜로 AI가 응원 한 줄. 생년월일은 저장하지 않고 요청 때만 받는다.
//  - 어제 돌아보기 한마디: 어제 기록을 보고 오늘 챙길 것 한 줄.
// 한 사람·하루에 한 번만 만들고 DB에 저장해 다시 쓴다(비용 절약).
import { sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

const ANIMALS = ["원숭이", "닭", "개", "돼지", "쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양"];
function zodiacAnimal(year: number) { return ANIMALS[((year % 12) + 12) % 12]; }
function starSign(m: number, d: number) {
  const md = m * 100 + d;
  if (md >= 321 && md <= 419) return "양자리"; if (md <= 520 && md >= 420) return "황소자리";
  if (md >= 521 && md <= 621) return "쌍둥이자리"; if (md >= 622 && md <= 722) return "게자리";
  if (md >= 723 && md <= 822) return "사자자리"; if (md >= 823 && md <= 922) return "처녀자리";
  if (md >= 923 && md <= 1022) return "천칭자리"; if (md >= 1023 && md <= 1121) return "전갈자리";
  if (md >= 1122 && md <= 1221) return "사수자리"; if (md >= 1222 || md <= 119) return "염소자리";
  if (md >= 120 && md <= 218) return "물병자리"; return "물고기자리";
}

/* ---------- 만세력: 일주(日柱) 계산과 십신 ---------- */
const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const ELEM_KO = ["목(나무)", "화(불)", "토(흙)", "금(쇠)", "수(물)"];
function jdn(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return day + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
/** 1949-10-01 = 갑자일 기준 공식 (JDN + 49) % 60 */
function dayPillar(d: string) {
  const i = ((jdn(d) + 49) % 60 + 60) % 60;
  const stem = i % 10, branch = i % 12;
  return { stem, branch, label: STEMS[stem] + BRANCHES[branch] };
}
const GODS: Record<string, string> = {
  "비견": "나와 같은 기운. 동료·친구와 힘을 합치기 좋고 자신감이 오르는 날",
  "겁재": "경쟁과 지출의 기운. 충동구매와 과식을 조심하면 좋은 날",
  "식신": "먹을 복과 여유의 기운. 몸을 챙기고 맛있게 건강식을 즐기기 좋은 날",
  "상관": "표현과 재치의 기운. 아이디어는 빛나지만 말 한마디를 조심할 날",
  "편재": "뜻밖의 기회와 활동의 기운. 바깥 활동과 새로운 시도가 잘 풀리는 날",
  "정재": "꾸준함의 결실 기운. 계획대로 차근차근 하면 보상이 따르는 날",
  "편관": "도전과 압박의 기운. 무리하지 말고 컨디션 관리가 중요한 날",
  "정관": "인정과 질서의 기운. 약속과 규칙을 지키면 칭찬받는 날",
  "편인": "직감과 혼자만의 시간 기운. 쉬면서 생각을 정리하기 좋은 날",
  "정인": "도움과 배움의 기운. 주변의 도움을 받고 몸과 마음이 채워지는 날",
};
function tenGod(myStem: number, todayStem: number) {
  const me = Math.floor(myStem / 2), t = Math.floor(todayStem / 2);
  const samePol = (myStem % 2) === (todayStem % 2);
  const d = ((t - me) % 5 + 5) % 5;
  const name = [samePol ? "비견" : "겁재", samePol ? "식신" : "상관", samePol ? "편재" : "정재", samePol ? "편관" : "정관", samePol ? "편인" : "정인"][d];
  return { name, mean: GODS[name] };
}
const FORTUNE_RULES = [
  "당신은 사주 명리학으로 '오늘의 운세'를 풀어 주는 해이언니입니다.",
  "주어진 일주·일진·십신 해석을 바탕으로, 오늘 어떤 운이 강한지와 무엇을 하면 좋을지를 구체적으로 씁니다.",
  "형식: 한국어 한두 문장, 60자 이내. 끝에 '행운 포인트: (색 또는 숫자 하나)'를 붙여도 좋습니다. 따옴표·이모지 없이.",
  "겁주는 말, 병·진단·약, 큰돈·투자 권유는 쓰지 않습니다. 몸·마음·식사·운동·관계 쪽으로 연결합니다.",
].join("\n");

function prevDate(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10);
}

async function ask(system: string, user: string, max = 80): Promise<string> {
  const r = await invokeLLM({ messages: [{ role: "system", content: system }, { role: "user", content: user }] } as any);
  const c = (r as any)?.choices?.[0]?.message?.content ?? "";
  return String(typeof c === "string" ? c : JSON.stringify(c)).replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0].slice(0, max + 20);
}

const RULES = [
  "당신은 다이어트·웰니스 커뮤니티 '슈퍼한입 챌린지'의 방장 해이언니입니다.",
  "따뜻하고 다정한 해요체로, 한국어 한 문장만 씁니다. 공백 포함 30자 이내로 아주 짧게. 따옴표·이모지·해시태그 없이.",
  "겁주는 말, 병·진단·약, 돈·재물, 연애 이야기는 쓰지 않습니다. 몸무게 숫자 얘기도 하지 않습니다.",
  "몸을 따뜻하게·잠·마음·클린한 식사·물·가벼운 운동 중 하나와 자연스럽게 연결합니다.",
].join("\n");

async function cacheGet(userId: number, date: string, kind: string): Promise<string | null> {
  const conn = await db.getDb(); if (!conn) return null;
  const res: any = await conn.execute(sql`SELECT text FROM dailyLines WHERE userId = ${userId} AND recordedDate = ${date} AND kind = ${kind} LIMIT 1`);
  const rows = Array.isArray(res?.[0]) ? res[0] : [];
  return rows[0]?.text ?? null;
}
async function cacheSet(userId: number, date: string, kind: string, text: string) {
  const conn = await db.getDb(); if (!conn) return;
  await conn.execute(sql`INSERT INTO dailyLines (userId, recordedDate, kind, text) VALUES (${userId}, ${date}, ${kind}, ${text}) ON DUPLICATE KEY UPDATE text = VALUES(text)`);
}

export async function getDailyLines(userId: number, date: string, opts: { birthDate?: string; fortune: boolean; coach: boolean }) {
  const out: { fortune: string | null; coach: string | null } = { fortune: null, coach: null };

  if (opts.fortune && opts.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.birthDate)) {
    const [by, bm, bd] = opts.birthDate.split("-").map(Number);
    const animal = zodiacAnimal(by);
    const me = dayPillar(opts.birthDate), today = dayPillar(date);
    const god = tenGod(me.stem, today.stem);
    const kind = `fortune2:${me.label}:${god.name}`;
    out.fortune = await cacheGet(userId, date, kind);
    if (!out.fortune) {
      try {
        out.fortune = await ask(FORTUNE_RULES,
          `내 일주(태어난 날): ${me.label}일주 (${ELEM_KO[Math.floor(me.stem / 2)]})\n오늘 일진: ${today.label}일 (${ELEM_KO[Math.floor(today.stem / 2)]})\n오늘의 십신: ${god.name} — ${god.mean}\n띠: ${animal}띠\n오늘의 운세:`, 70);
        if (out.fortune) await cacheSet(userId, date, kind, out.fortune);
      } catch (e) { console.warn("[dailyLines] fortune failed", e); }
    }
  }

  if (opts.coach) {
    const kind = "coach";
    out.coach = await cacheGet(userId, date, kind);
    if (!out.coach) {
      try {
        const y = prevDate(date);
        const [sleep, meals, waters, exercises, note] = await Promise.all([
          db.getSleepByDate(userId, date).catch(() => null),           // 어젯밤 잠 = 오늘 기상일 기록
          db.listMealsByUserDate(userId, y).catch(() => [] as any[]),
          db.listWatersByDate(userId, y).catch(() => [] as any[]),
          db.listExercisesByUserDate(userId, y).catch(() => [] as any[]),
          db.getHappyNote(userId, date).catch(() => null),
        ]);
        const facts = [
          sleep ? `어젯밤 수면 ${Math.floor((sleep as any).durationMinutes / 60)}시간 ${(sleep as any).durationMinutes % 60}분 (${(sleep as any).bedHour}시 취침)` : "어젯밤 수면 기록 없음",
          `어제 식사 기록 ${meals.length}번` + (meals.length ? ` (단백질 합계 ${meals.reduce((a: number, m: any) => a + (m.proteinG || 0), 0)}g, 야채 먹은 끼니 ${meals.filter((m: any) => (m.vegetableG || 0) > 0).length}번)` : ""),
          `어제 물 ${waters.reduce((a: number, w: any) => a + (w.volumeMl || 0), 0)}ml`,
          `어제 운동 ${exercises.length ? exercises.map((e: any) => `${e.kind ?? "운동"} ${e.minutes ?? ""}분`).join(", ") : "기록 없음"}`,
          note ? `어제 기분 점수 ${(note as any).mood}/4, 몸 따뜻하게 ${(note as any).warm ? "함" : "안 함"}` : "",
        ].filter(Boolean).join("\n");
        out.coach = await ask(RULES + "\n아래 어제 기록을 보고 오늘 하루 챙기면 좋을 것 하나를 조언합니다. 잘한 게 있으면 먼저 짧게 칭찬해도 좋아요. 매번 표현을 다르게.",
          `${facts}\n오늘의 한마디:`);
        if (out.coach) await cacheSet(userId, date, kind, out.coach);
      } catch (e) { console.warn("[dailyLines] coach failed", e); }
    }
  }
  return out;
}
