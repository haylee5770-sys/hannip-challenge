// 몸 정보·컨디션·운동 상세·하루 권장량·코멘트·방장 전용 멤버 상세 (2026-11-21)
// 근거: 보건복지부·한국영양학회 「한국인 영양소 섭취기준」 에너지필요추정량 공식과 탄단지 비율,
//       대한비만학회 BMI 기준(18.5 미만 저체중), 국제 신체활동 기준표(Compendium of Physical Activities) MET 값.
// 진단이 아니라 공식 기준으로 계산한 참고 안내다.
import { sql } from "drizzle-orm";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
function rowsOf(res: any): any[] { return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : []; }
async function q(query: any): Promise<any[]> { const conn = await db.getDb(); if (!conn) return []; return rowsOf(await conn.execute(query)); }

export const WELLNESS_SCHEMA: Array<[string, string]> = [
  [`CREATE TABLE IF NOT EXISTS bodyProfiles (
    userId INT PRIMARY KEY,
    sex VARCHAR(8) NOT NULL,
    birthYear INT NOT NULL,
    heightCm DECIMAL(5,1) NOT NULL,
    activity VARCHAR(16) NOT NULL DEFAULT 'low',
    pregnant TINYINT NOT NULL DEFAULT 0,
    lactating TINYINT NOT NULL DEFAULT 0,
    flags VARCHAR(255) NOT NULL DEFAULT '',
    healthNote TEXT,
    healthConsent TINYINT NOT NULL DEFAULT 0,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`, "bodyProfiles"],
  [`CREATE TABLE IF NOT EXISTS dailyConditions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    recordedDate DATE NOT NULL,
    level VARCHAR(16) NOT NULL,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY dailyConditions_ud (userId, recordedDate)
  )`, "dailyConditions"],
  [`CREATE TABLE IF NOT EXISTS exerciseDetails (
    exerciseId INT PRIMARY KEY,
    userId INT NOT NULL,
    sport VARCHAR(32) NOT NULL DEFAULT '',
    distanceKm DECIMAL(6,2),
    paceSec INT,
    speedKmh DECIMAL(5,1),
    steps INT,
    avgHr INT,
    laps INT,
    kcalWatch INT,
    feel VARCHAR(16) NOT NULL DEFAULT 'ok',
    sweat TINYINT NOT NULL DEFAULT 0,
    comment TEXT,
    INDEX exerciseDetails_u (userId)
  )`, "exerciseDetails"],
];

export async function ensureWellnessSchema() {
  const conn = await db.getDb(); if (!conn) return;
  for (const [stmt, label] of WELLNESS_SCHEMA) {
    try { await conn.execute(sql.raw(stmt)); console.log("[ensureSchema] ok", label); }
    catch (e: any) { console.warn("[ensureSchema] skip", label, (e?.cause?.message ?? e?.message ?? "").slice(0, 120)); }
  }
}

/* ---------- 몸 정보 ---------- */
export const FLAG_KEYS = ["diabetes", "kidney", "thyroid", "eating", "heart", "doctor"] as const;
export type Flag = typeof FLAG_KEYS[number];
export type BodyProfile = {
  sex: "female" | "male"; birthYear: number; heightCm: number; activity: "low" | "mid" | "high";
  pregnant: boolean; lactating: boolean; flags: Flag[]; healthNote: string | null; healthConsent: boolean;
};

export async function getProfile(userId: number): Promise<BodyProfile | null> {
  const r = (await q(sql`SELECT * FROM bodyProfiles WHERE userId=${userId} LIMIT 1`))[0];
  if (!r) return null;
  return {
    sex: r.sex === "male" ? "male" : "female", birthYear: Number(r.birthYear), heightCm: Number(r.heightCm),
    activity: (["low", "mid", "high"].includes(r.activity) ? r.activity : "low") as any,
    pregnant: !!Number(r.pregnant), lactating: !!Number(r.lactating),
    flags: String(r.flags ?? "").split(",").filter((f: string) => (FLAG_KEYS as readonly string[]).includes(f)) as Flag[],
    healthNote: r.healthNote ?? null, healthConsent: !!Number(r.healthConsent),
  };
}

export async function saveProfile(userId: number, p: BodyProfile, weightKg?: number) {
  const note = p.healthConsent ? (p.healthNote ?? "").trim().slice(0, 1000) || null : null;
  await q(sql`INSERT INTO bodyProfiles (userId, sex, birthYear, heightCm, activity, pregnant, lactating, flags, healthNote, healthConsent)
    VALUES (${userId}, ${p.sex}, ${p.birthYear}, ${p.heightCm}, ${p.activity}, ${p.pregnant ? 1 : 0}, ${p.lactating ? 1 : 0}, ${p.flags.join(",")}, ${note}, ${p.healthConsent ? 1 : 0})
    ON DUPLICATE KEY UPDATE sex=VALUES(sex), birthYear=VALUES(birthYear), heightCm=VALUES(heightCm), activity=VALUES(activity),
      pregnant=VALUES(pregnant), lactating=VALUES(lactating), flags=VALUES(flags), healthNote=VALUES(healthNote), healthConsent=VALUES(healthConsent)`);
  if (weightKg) {
    await db.upsertWeight({ userId, recordedDate: kstToday(), weightKg: weightKg.toFixed(2), note: "가입 때 입력" } as any);
  }
}

export async function latestWeight(userId: number): Promise<number | null> {
  const r = (await q(sql`SELECT weightKg FROM weights WHERE userId=${userId} ORDER BY recordedDate DESC LIMIT 1`))[0];
  return r ? Number(r.weightKg) : null;
}

/* ---------- 컨디션 ---------- */
export const CONDITIONS = ["best", "ok", "meh", "tired"] as const;
export type Condition = typeof CONDITIONS[number];
export async function getCondition(userId: number, date: string): Promise<Condition | null> {
  const r = (await q(sql`SELECT level FROM dailyConditions WHERE userId=${userId} AND recordedDate=${date} LIMIT 1`))[0];
  return r ? (r.level as Condition) : null;
}
export async function setCondition(userId: number, date: string, level: Condition) {
  await q(sql`INSERT INTO dailyConditions (userId, recordedDate, level) VALUES (${userId}, ${date}, ${level})
    ON DUPLICATE KEY UPDATE level=VALUES(level)`);
}

/* ---------- 운동 종류 (삼성 헬스와 비슷한 이름, 많이 하는 순서) ----------
   met: 국제 신체활동 기준표의 대표값 (편안/적당/숨이 턱끝까지) */
export const SPORTS: Array<{ id: string; name: string; kind: "distance" | "cycle" | "swim" | "time"; met: [number, number, number] }> = [
  { id: "walk", name: "걷기", kind: "distance", met: [2.8, 3.5, 4.3] },
  { id: "fastwalk", name: "빠르게 걷기", kind: "distance", met: [4.3, 5.0, 6.0] },
  { id: "run", name: "달리기", kind: "distance", met: [7.0, 9.0, 11.0] },
  { id: "treadmill", name: "러닝머신", kind: "distance", met: [4.5, 7.0, 9.8] },
  { id: "hike", name: "등산", kind: "distance", met: [5.3, 6.5, 8.0] },
  { id: "stairs", name: "계단 오르기", kind: "time", met: [4.0, 6.0, 8.8] },
  { id: "ibike", name: "실내 자전거", kind: "cycle", met: [3.5, 6.8, 8.8] },
  { id: "bike", name: "자전거", kind: "cycle", met: [4.0, 6.8, 10.0] },
  { id: "swim", name: "수영", kind: "swim", met: [5.8, 7.0, 9.8] },
  { id: "yoga", name: "요가", kind: "time", met: [2.5, 3.0, 4.0] },
  { id: "pilates", name: "필라테스", kind: "time", met: [3.0, 3.5, 4.5] },
  { id: "weight", name: "근력운동(헬스)", kind: "time", met: [3.5, 5.0, 6.0] },
  { id: "home", name: "홈트", kind: "time", met: [3.5, 5.0, 8.0] },
  { id: "rope", name: "줄넘기", kind: "time", met: [8.8, 11.8, 12.3] },
  { id: "stretch", name: "스트레칭", kind: "time", met: [2.3, 2.5, 3.0] },
  { id: "dance", name: "댄스", kind: "time", met: [4.5, 6.0, 7.8] },
  { id: "etc", name: "기타", kind: "time", met: [3.0, 4.5, 6.0] },
];
export const FEELS = ["easy", "ok", "max"] as const;
export type Feel = typeof FEELS[number];

/** 운동으로 더 쓴 에너지(kcal, 가만히 있을 때 몫 제외). 페이스·속도·심박이 있으면 반영 */
export function exerciseKcal(o: { sport: string; feel: Feel; minutes: number; weightKg: number; paceSec?: number | null; speedKmh?: number | null; sweat?: boolean }): number {
  const s = SPORTS.find(x => x.id === o.sport) ?? SPORTS[SPORTS.length - 1];
  let met = s.met[o.feel === "easy" ? 0 : o.feel === "max" ? 2 : 1];
  // 달리기·걷기는 페이스(분/km)로 MET를 더 정확히: 속도 km/h ≈ 60/페이스(분)
  const kmh = o.speedKmh ?? (o.paceSec ? 3600 / o.paceSec : null);
  if (kmh && (s.kind === "distance")) {
    if (kmh >= 12) met = 11.5; else if (kmh >= 10.8) met = 11.0; else if (kmh >= 9.7) met = 10.0; else if (kmh >= 8.4) met = 9.0;
    else if (kmh >= 8.0) met = 8.3; else if (kmh >= 6.4) met = 6.0; else if (kmh >= 5.6) met = 4.3; else if (kmh >= 4.8) met = 3.5; else met = 2.8;
  }
  if (kmh && s.kind === "cycle") { met = kmh >= 25 ? 10 : kmh >= 19 ? 8 : kmh >= 16 ? 6.8 : 4.0; }
  return Math.max(0, Math.round((met - 1) * o.weightKg * (o.minutes / 60)));
}

/* ---------- 하루 권장량 (한국인 영양소 섭취기준) ---------- */
const PA: Record<"female" | "male", Record<"low" | "mid" | "high", number>> = {
  // 한국인 영양소 섭취기준 신체활동계수: 저활동적 / 활동적 / 매우 활동적
  female: { low: 1.12, mid: 1.27, high: 1.45 },
  male: { low: 1.11, mid: 1.25, high: 1.48 },
};
export type Targets = { kcal: number; carbsG: number; proteinG: number; fatG: number; vegetableG: number; exerciseKcal: number; basis: string };

export async function dailyTargets(userId: number, date: string): Promise<Targets | null> {
  const p = await getProfile(userId); const w = await latestWeight(userId);
  if (!p || !w) return null;
  const age = Math.max(19, Number(date.slice(0, 4)) - p.birthYear);
  const h = p.heightCm / 100;
  let eer = p.sex === "male"
    ? 662 - 9.53 * age + PA.male[p.activity] * (15.91 * w + 539.6 * h)
    : 354 - 6.91 * age + PA.female[p.activity] * (9.36 * w + 726 * h);
  if (p.pregnant) eer += 340;
  if (p.lactating) eer += 340;
  // 그날 운동
  const ex = await q(sql`SELECT e.durationMin, d.sport, d.feel, d.paceSec, d.speedKmh, d.sweat, e.intensity FROM exercises e LEFT JOIN exerciseDetails d ON d.exerciseId = e.id WHERE e.userId=${userId} AND e.recordedDate=${date}`);
  let exK = 0;
  for (const e of ex) {
    const feel: Feel = e.feel ?? (e.intensity === "low" ? "easy" : e.intensity === "high" ? "max" : "ok");
    exK += exerciseKcal({ sport: e.sport ?? "etc", feel, minutes: Number(e.durationMin), weightKg: w, paceSec: e.paceSec ? Number(e.paceSec) : null, speedKmh: e.speedKmh ? Number(e.speedKmh) : null });
  }
  const kcal = Math.round(eer + exK);
  // 탄 55% · 지 25% · 단백질은 몸무게 1kg당 1.2g(최소 섭취기준 이상), 채소 350g
  let proteinG = Math.round(w * 1.2);
  if (p.flags.includes("kidney")) proteinG = Math.round(w * 0.8);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(100, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, carbsG, proteinG, fatG, vegetableG: 350, exerciseKcal: exK, basis: "한국인 영양소 섭취기준(에너지필요추정량·탄단지 비율), 국제 신체활동 기준표" };
}

export async function intakeOf(userId: number, date: string) {
  const r = (await q(sql`SELECT COUNT(*) n, COALESCE(SUM(carbsG),0) c, COALESCE(SUM(proteinG),0) p, COALESCE(SUM(fatG),0) f, COALESCE(SUM(vegetableG),0) v FROM meals WHERE userId=${userId} AND recordedDate=${date}`))[0] ?? {};
  const c = Number(r.c ?? 0), p = Number(r.p ?? 0), f = Number(r.f ?? 0);
  return { meals: Number(r.n ?? 0), carbsG: c, proteinG: p, fatG: f, vegetableG: Number(r.v ?? 0), kcal: c * 4 + p * 4 + f * 9 };
}

/** 오늘 먹은 양 한 줄 (부족을 더 강하게) */
export async function intakeLine(userId: number, date: string) {
  const t = await dailyTargets(userId, date);
  if (!t) return { targets: null, line: null as string | null, level: "none" as const };
  const i = await intakeOf(userId, date);
  const ratio = i.kcal / t.kcal;
  const pr = i.proteinG / t.proteinG;
  const hourKst = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  const isToday = date === kstToday();
  let line: string; let level: "low" | "ok" | "high" | "none";
  if (i.meals === 0) { line = "아직 기록이 없어요. 오늘도 든든하게 챙겨 드세요."; level = "none"; }
  else if (ratio > 1.2) { line = `권장량을 넘었어요 (약 ${Math.round(ratio * 100)}%). 남은 끼니는 가볍게 채소 위주로 드세요.`; level = "high"; }
  else if (ratio < 0.7 && (!isToday || hourKst >= 18)) { line = `⚠️ 오늘 먹은 양이 권장량의 ${Math.round(ratio * 100)}%예요. 너무 적어요. 한 끼 더 챙겨 드세요.${pr < 0.7 ? ` 특히 단백질이 ${Math.max(0, t.proteinG - i.proteinG)}g 부족해요.` : ""}`; level = "low"; }
  else if (ratio < 0.7) { line = `지금까지 권장량의 ${Math.round(ratio * 100)}%예요. 남은 끼니도 꼭 챙겨 드세요.${pr < 0.5 ? ` 단백질이 ${Math.max(0, t.proteinG - i.proteinG)}g 남았어요.` : ""}`; level = "low"; }
  else { line = `알맞게 먹고 있어요 (권장량의 ${Math.round(ratio * 100)}%).${pr < 0.8 ? ` 단백질만 ${Math.max(0, t.proteinG - i.proteinG)}g 더 채워요.` : ""}`; level = "ok"; }
  return { targets: { carbsG: t.carbsG, proteinG: t.proteinG, fatG: t.fatG, vegetableG: t.vegetableG, basis: t.basis }, line, level };
}

/* ---------- 운동 코멘트 (정해 둔 기준으로만, 같은 상황이면 같은 말) ---------- */
export async function exerciseComment(userId: number, date: string, o: { sport: string; minutes: number; feel: Feel; sweat: boolean; distanceKm?: number | null; paceSec?: number | null; speedKmh?: number | null }) {
  const p = await getProfile(userId); const w = (await latestWeight(userId)) ?? 55;
  const sportName = SPORTS.find(s => s.id === o.sport)?.name ?? "운동";
  const kcal = exerciseKcal({ ...o, weightKg: w });
  const hard = o.feel === "max" || kcal >= 300 || o.minutes >= 90;
  const warn: string[] = [];
  // 어제 먹은 양 (기록이 있을 때만 판단: 안 올린 날은 굶은 건지 알 수 없어서)
  const y = addDays(date, -1);
  const yi = await intakeOf(userId, y); const yt = await dailyTargets(userId, y);
  const yRatio = yi.meals > 0 && yt ? yi.kcal / yt.kcal : null;
  const cond = await getCondition(userId, date);
  const bmi = p ? w / Math.pow(p.heightCm / 100, 2) : null;
  if (yRatio != null && yRatio < 0.5 && hard) warn.push(`어제 먹은 양이 권장량의 ${Math.round(yRatio * 100)}%였어요. 오늘은 무리한 운동보다 먼저 잘 챙겨 드세요.`);
  if (cond === "tired" && hard) warn.push("오늘 컨디션이 '힘이 없어요'인데 강하게 했어요. 다음엔 강도를 낮춰 가볍게 움직여요.");
  if (bmi != null && bmi < 18.5 && (hard || o.minutes >= 60)) warn.push("몸에 비해 운동량이 많아요. 강도를 조금 낮추고 충분히 드세요.");
  if (p?.flags.includes("diabetes") && yRatio != null && yRatio < 0.6) warn.push("혈당 관리 중이라면 공복 운동은 저혈당 위험이 있어요. 꼭 먹고 움직여요.");
  if ((p?.flags.includes("heart") || p?.pregnant) && o.feel === "max") warn.push("'숨이 턱끝까지'는 지금 몸 상태에 무리일 수 있어요. 담당 의사 지침을 먼저 따르세요.");
  const what = [sportName, o.distanceKm ? `${o.distanceKm}km` : null, `${o.minutes}분`, o.paceSec ? `페이스 ${Math.floor(o.paceSec / 60)}'${String(o.paceSec % 60).padStart(2, "0")}"` : null].filter(Boolean).join(" · ");
  if (warn.length) return { text: `⚠️ ${warn[0]}`, what, warn: true, kcal };
  const yProteinLow = yRatio != null && yt && yi.proteinG < yt.proteinG * 0.7;
  const good = o.feel === "max" ? "정말 열심히 했어요!" : o.feel === "ok" ? "알맞게 잘 움직였어요." : "가볍게 꾸준히, 아주 좋아요.";
  return { text: `${good}${o.sweat ? " 땀 흘린 만큼 물도 충분히 마셔요." : ""}${yProteinLow ? " 어제 단백질이 부족했으니 오늘은 단백질을 꼭 챙겨요." : hard ? " 운동한 만큼 오늘은 더 먹어도 돼요." : ""}`, what, warn: false, kcal };
}

/* ---------- 워치 캡처 자동 채우기 ---------- */
export async function analyzeWorkoutImage(url: string) {
  const SCHEMA = {
    type: "object",
    properties: {
      sport: { type: "string", enum: SPORTS.map(s => s.id) },
      minutes: { type: "number" }, distanceKm: { type: "number" }, paceSec: { type: "number" },
      speedKmh: { type: "number" }, steps: { type: "number" }, avgHr: { type: "number" }, laps: { type: "number" }, kcal: { type: "number" },
    },
    required: ["sport", "minutes", "distanceKm", "paceSec", "speedKmh", "steps", "avgHr", "laps", "kcal"],
    additionalProperties: false,
  };
  const res = await invokeLLM({
    messages: [
      { role: "system", content: "운동 앱·스마트워치(삼성 헬스, 애플 워치, 가민, 나이키 런 등) 기록 화면 캡처에서 숫자를 그대로 읽습니다. 화면에 없는 값은 0. 시간은 분 단위(초는 반올림), 평균 페이스는 1km당 초(예: 6'30\" → 390), 거리는 km(수영은 m를 km로). sport는 목록에서 가장 가까운 것." },
      { role: "user", content: [{ type: "text", text: "이 운동 기록 화면을 읽어 JSON으로 답해 주세요." }, { type: "image_url", image_url: { url, detail: "high" } }] as any },
    ],
    response_format: { type: "json_schema", json_schema: { name: "workout", strict: true, schema: SCHEMA } },
  } as any);
  const raw = (res as any)?.choices?.[0]?.message?.content ?? "{}";
  try {
    const j = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    const n = (v: any, max: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 && x <= max ? x : null; };
    return {
      sport: SPORTS.some(s => s.id === j.sport) ? j.sport : "etc",
      minutes: n(Math.round(j.minutes), 1440), distanceKm: n(Math.round(Number(j.distanceKm) * 100) / 100, 500),
      paceSec: n(Math.round(j.paceSec), 3600), speedKmh: n(Math.round(Number(j.speedKmh) * 10) / 10, 100),
      steps: n(Math.round(j.steps), 200000), avgHr: n(Math.round(j.avgHr), 250), laps: n(Math.round(j.laps), 1000), kcal: n(Math.round(j.kcal), 10000),
    };
  } catch { return null; }
}

export async function saveExerciseDetail(exerciseId: number, userId: number, d: { sport: string; distanceKm?: number | null; paceSec?: number | null; speedKmh?: number | null; steps?: number | null; avgHr?: number | null; laps?: number | null; kcalWatch?: number | null; feel: Feel; sweat: boolean; comment: string }) {
  await q(sql`INSERT INTO exerciseDetails (exerciseId, userId, sport, distanceKm, paceSec, speedKmh, steps, avgHr, laps, kcalWatch, feel, sweat, comment)
    VALUES (${exerciseId}, ${userId}, ${d.sport}, ${d.distanceKm ?? null}, ${d.paceSec ?? null}, ${d.speedKmh ?? null}, ${d.steps ?? null}, ${d.avgHr ?? null}, ${d.laps ?? null}, ${d.kcalWatch ?? null}, ${d.feel}, ${d.sweat ? 1 : 0}, ${d.comment})`);
}
export async function exerciseDetailsFor(ids: number[]) {
  if (!ids.length) return [];
  return q(sql`SELECT * FROM exerciseDetails WHERE exerciseId IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`);
}

/* ---------- 밤 12시 잠금 ---------- */
export function assertEditable(user: { role: string }, date: string) {
  if (user.role === "admin") return;
  if (date < kstToday()) throw new Error("PAST_LOCKED");
}

/* ---------- 방장 전용: 멤버 상세 · 챙겨야 할 크루 ---------- */
export async function memberDetail(userId: number, days = 14) {
  const user = await db.getUserById(userId);
  const profile = await getProfile(userId);
  const today = kstToday(); const since = addDays(today, -(days - 1));
  const weights = await q(sql`SELECT DATE_FORMAT(recordedDate,'%Y-%m-%d') d, weightKg FROM weights WHERE userId=${userId} ORDER BY recordedDate`);
  const conds = await q(sql`SELECT DATE_FORMAT(recordedDate,'%Y-%m-%d') d, level FROM dailyConditions WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${today}`);
  const moods = await q(sql`SELECT DATE_FORMAT(recordedDate,'%Y-%m-%d') d, mood, warm, slept, cleanEat, exercised FROM happyNotes WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${today}`).catch(() => []);
  const meals = await q(sql`SELECT DATE_FORMAT(recordedDate,'%Y-%m-%d') d, COUNT(*) n, SUM(carbsG) c, SUM(proteinG) p, SUM(fatG) f, SUM(vegetableG) v FROM meals WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${today} GROUP BY recordedDate`);
  const exs = await q(sql`SELECT DATE_FORMAT(e.recordedDate,'%Y-%m-%d') d, e.kind, e.durationMin, d.feel, d.sweat, d.distanceKm, d.comment FROM exercises e LEFT JOIN exerciseDetails d ON d.exerciseId=e.id WHERE e.userId=${userId} AND e.recordedDate BETWEEN ${since} AND ${today} ORDER BY e.id`);
  const sleeps = await q(sql`SELECT DATE_FORMAT(recordedDate,'%Y-%m-%d') d, durationMinutes FROM sleeps WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${today}`);
  const waters = await q(sql`SELECT DATE_FORMAT(recordedDate,'%Y-%m-%d') d, SUM(volumeMl) ml FROM waters WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${today} GROUP BY recordedDate`);
  const rows: any[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const m = meals.find(x => x.d === d); const t = m ? await dailyTargets(userId, d) : null;
    const kcal = m ? Number(m.c) * 4 + Number(m.p) * 4 + Number(m.f) * 9 : 0;
    rows.push({
      date: d,
      condition: conds.find(x => x.d === d)?.level ?? null,
      mood: moods.find(x => x.d === d)?.mood ?? null,
      meals: m ? { n: Number(m.n), carbsG: Number(m.c), proteinG: Number(m.p), fatG: Number(m.f), vegetableG: Number(m.v), pct: t ? Math.round((kcal / t.kcal) * 100) : null } : null,
      exercises: exs.filter(x => x.d === d).map(x => ({ kind: x.kind, min: Number(x.durationMin), feel: x.feel, sweat: !!Number(x.sweat), km: x.distanceKm ? Number(x.distanceKm) : null, comment: x.comment })),
      sleepMin: sleeps.find(x => x.d === d) ? Number(sleeps.find(x => x.d === d)!.durationMinutes) : null,
      waterMl: waters.find(x => x.d === d) ? Number(waters.find(x => x.d === d)!.ml) : null,
    });
  }
  const tiredDays = rows.slice(0, 7).filter(r => r.condition === "tired").length;
  const lowDays = rows.slice(1, 8).filter(r => r.meals?.pct != null && r.meals.pct < 70).length;
  const summary = [tiredDays ? `최근 7일 중 ${tiredDays}일 '힘이 없어요'` : null, lowDays ? `최근 7일 중 ${lowDays}일 권장량보다 적게 먹음` : null].filter(Boolean) as string[];
  const w = await latestWeight(userId);
  return {
    user: user ? { id: user.id, name: user.name, realName: (user as any).realName ?? null } : null,
    profile, age: profile ? Number(today.slice(0, 4)) - profile.birthYear : null,
    latestWeight: w, bmi: profile && w ? Math.round((w / Math.pow(profile.heightCm / 100, 2)) * 10) / 10 : null,
    weights: weights.map(x => ({ date: x.d, kg: Number(x.weightKg) })), days: rows, summary,
  };
}

export async function careList() {
  const users = await db.listApprovedUsers();
  const today = kstToday(); const since = addDays(today, -6); const y = addDays(today, -1);
  const out: Array<{ userId: number; name: string; reasons: string[] }> = [];
  for (const u of users) {
    const reasons: string[] = [];
    const tired = Number((await q(sql`SELECT COUNT(*) c FROM dailyConditions WHERE userId=${u.id} AND level='tired' AND recordedDate BETWEEN ${since} AND ${today}`))[0]?.c ?? 0);
    if (tired >= 2) reasons.push(`최근 7일 중 ${tired}일 '힘이 없어요'`);
    const yi = await intakeOf(u.id, y);
    if (yi.meals > 0) { const t = await dailyTargets(u.id, y); if (t && yi.kcal / t.kcal < 0.6) reasons.push(`어제 권장량의 ${Math.round((yi.kcal / t.kcal) * 100)}%만 먹음`); }
    const p = await getProfile(u.id);
    if (p && (p.flags.length || p.pregnant || p.lactating || p.healthNote)) reasons.push("몸 상태 특이사항 있음");
    if (reasons.length) out.push({ userId: u.id, name: u.name ?? "?", reasons });
  }
  return out;
}

/* ---------- 이번 달 몸무게 쟀는지 ---------- */
export async function weighInStatus(userId: number) {
  const today = kstToday(); const month = today.slice(0, 7);
  const r = (await q(sql`SELECT COUNT(*) c FROM weights WHERE userId=${userId} AND DATE_FORMAT(recordedDate,'%Y-%m')=${month}`))[0];
  return { isFirstDay: today.slice(8) === "01", doneThisMonth: Number(r?.c ?? 0) > 0 };
}
