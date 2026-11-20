// 회차(챌린지) 시작·종료, 항목별 인증 번호, 시상(이게돼·꾸준함), 이게돼 글 (2026-11-20)
import { sql } from "drizzle-orm";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

export const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function rowsOf(res: any): any[] { return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : []; }
async function q(query: any): Promise<any[]> { const conn = await db.getDb(); if (!conn) return []; return rowsOf(await conn.execute(query)); }

export const ROUND_SCHEMA: Array<[string, string]> = [
  [`CREATE TABLE IF NOT EXISTS roundAwards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seasonId INT NOT NULL,
    kind VARCHAR(32) NOT NULL,
    rankNo INT NOT NULL DEFAULT 1,
    userId INT NOT NULL,
    name VARCHAR(128) NOT NULL,
    count INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX roundAwards_s (seasonId)
  )`, "roundAwards"],
  [`CREATE TABLE IF NOT EXISTS itgeNotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    recordedDate DATE NOT NULL,
    content TEXT NOT NULL,
    summary VARCHAR(200) NOT NULL DEFAULT '',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX itgeNotes_u (userId, recordedDate)
  )`, "itgeNotes"],
  ["ALTER TABLE seasons ADD COLUMN IF NOT EXISTS roundType VARCHAR(32) NOT NULL DEFAULT ''", "seasons.roundType"],
  ["ALTER TABLE sleeps ADD COLUMN IF NOT EXISTS morningPhotoUrl TEXT", "sleeps.morningPhotoUrl"],
];

export async function ensureRoundSchema() {
  const conn = await db.getDb(); if (!conn) return;
  for (const [stmt, label] of ROUND_SCHEMA) {
    try { await conn.execute(sql.raw(stmt)); console.log("[ensureSchema] ok", label); }
    catch (e: any) { console.warn("[ensureSchema] skip", label, (e?.cause?.message ?? e?.message ?? "").slice(0, 120)); }
  }
}

/* ---------- 회차 범위 ---------- */
export const APP_RESTART_DATE = "2026-11-20";
export async function activeRound() {
  const s = await db.getActiveSeason().catch(() => null);
  return s ?? null;
}
/** 번호를 셀 범위: 진행 중 회차가 있으면 시작일부터, 없으면 올해 1월 1일부터 */
export async function countRange(): Promise<{ since: string; until: string; seasonId: number | null; name: string | null }> {
  const s = await activeRound();
  const today = kstToday();
  if (s) return { since: String(s.startDate).slice(0, 10), until: today, seasonId: s.id, name: s.name };
  // 진행 중 회차가 없을 때: 새 앱을 다시 연 날(2026-11-20)부터 센다. (올해 상반기 예전 기록이 섞여 번호가 어긋났던 문제, 2026-11-21)
  return { since: APP_RESTART_DATE, until: today, seasonId: null, name: null };
}

/* ---------- 항목별 인증 번호 ---------- */
export type ItemCounts = { meal: number; smoothie: number; water: number; exercise: number; wake: number; itge: number; total: number };
export async function itemCounts(userId: number, since: string, until: string): Promise<ItemCounts> {
  const one = async (query: any) => Number((await q(query))[0]?.c ?? 0);
  const [meal, smoothie, water, exercise, wake, itge] = await Promise.all([
    one(sql`SELECT COUNT(*) c FROM meals WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until} AND category <> 'smoothie'`),
    one(sql`SELECT COUNT(*) c FROM meals WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until} AND category = 'smoothie'`),
    one(sql`SELECT COUNT(*) c FROM waters WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until}`),
    one(sql`SELECT COUNT(*) c FROM exercises WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until}`),
    one(sql`SELECT COUNT(*) c FROM sleeps WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until}`),
    one(sql`SELECT COUNT(*) c FROM itgeNotes WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until}`).catch(() => 0),
  ]);
  return { meal, smoothie, water, exercise, wake, itge, total: meal + smoothie + water + exercise + wake };
}

/* ---------- 순위 (모든 멤버) ---------- */
async function rankAll(since: string, until: string) {
  const users = await db.listApprovedUsers();
  const rows = await Promise.all(users.map(async u => ({ userId: u.id, name: u.name ?? "멤버", c: await itemCounts(u.id, since, until) })));
  const byItge = rows.filter(r => r.c.itge > 0).sort((a, b) => b.c.itge - a.c.itge).slice(0, 3).map(r => ({ userId: r.userId, name: r.name, count: r.c.itge }));
  const byTotal = rows.filter(r => r.c.total > 0).sort((a, b) => b.c.total - a.c.total).slice(0, 3).map(r => ({ userId: r.userId, name: r.name, count: r.c.total }));
  return { byItge, byTotal, participants: rows.filter(r => r.c.total + r.c.itge > 0).length };
}

/* ---------- 시작 / 종료 ---------- */
const TYPE_LABEL: Record<string, string> = { detox: "3일 디톡스", mini: "미니 챌린지" };
export async function startRound(adminId: number, type: "detox" | "mini") {
  const cur = await activeRound();
  if (cur) await endRound();
  const all = await db.listSeasons();
  const n = all.reduce((m: number, s: any) => Math.max(m, s.seasonNumber ?? 0), 0) + 1;
  const today = kstToday();
  const id = await db.createSeason({ seasonNumber: n, totalDays: 365, name: `${n}회차 ${TYPE_LABEL[type]}`, startDate: today, endDate: addDays(today, 364), status: "active", createdByUserId: adminId } as any);
  await q(sql`UPDATE seasons SET roundType=${type} WHERE id=${id}`);
  return { id, seasonNumber: n };
}

export async function endRound() {
  const cur = await activeRound();
  if (!cur) return { ok: false, message: "진행 중인 챌린지가 없어요." };
  const today = kstToday();
  const since = String(cur.startDate).slice(0, 10);
  await q(sql`UPDATE seasons SET endDate=${today}, totalDays=${Math.max(1, Math.round((Date.parse(today) - Date.parse(since)) / 86400000) + 1)}, status='ended' WHERE id=${cur.id}`);
  const r = await rankAll(since, today);
  await q(sql`DELETE FROM roundAwards WHERE seasonId=${cur.id}`);
  for (const [kind, list] of [["itge", r.byItge], ["total", r.byTotal]] as const) {
    let i = 1;
    for (const w of list) { await q(sql`INSERT INTO roundAwards (seasonId, kind, rankNo, userId, name, count) VALUES (${cur.id}, ${kind}, ${i++}, ${w.userId}, ${w.name}, ${w.count})`); }
  }
  return { ok: true, seasonId: cur.id };
}

/* ---------- 시상식 / 역대 ---------- */
async function storedAwards(seasonId: number) {
  const rows = await q(sql`SELECT id, kind, rankNo, userId, name, count FROM roundAwards WHERE seasonId=${seasonId} ORDER BY kind, rankNo`);
  return {
    byItge: rows.filter(r => r.kind === "itge").map(r => ({ id: r.id, userId: r.userId, name: r.name, count: r.count, rankNo: r.rankNo })),
    byTotal: rows.filter(r => r.kind === "total").map(r => ({ id: r.id, userId: r.userId, name: r.name, count: r.count, rankNo: r.rankNo })),
  };
}

export async function ceremony() {
  const cur = await activeRound();
  if (cur) {
    const since = String(cur.startDate).slice(0, 10);
    const live = await rankAll(since, kstToday());
    return { status: "live" as const, season: { id: cur.id, name: cur.name, startDate: since, endDate: null as string | null }, ...live };
  }
  const ended = await q(sql`SELECT id, name, DATE_FORMAT(startDate,'%Y-%m-%d') s, DATE_FORMAT(endDate,'%Y-%m-%d') e FROM seasons WHERE status='ended' ORDER BY endDate DESC, id DESC LIMIT 1`);
  if (!ended[0]) return { status: "none" as const, season: null, byItge: [], byTotal: [], participants: 0 };
  const a = await storedAwards(ended[0].id);
  return { status: "final" as const, season: { id: ended[0].id, name: ended[0].name, startDate: ended[0].s, endDate: ended[0].e }, ...a, participants: 0 };
}

export async function history() {
  const seasons = await q(sql`SELECT id, name, DATE_FORMAT(startDate,'%Y-%m-%d') s, DATE_FORMAT(endDate,'%Y-%m-%d') e FROM seasons WHERE status='ended' ORDER BY endDate DESC, id DESC`);
  return Promise.all(seasons.map(async s => ({ id: s.id, name: s.name, startDate: s.s, endDate: s.e, ...(await storedAwards(s.id)) })));
}

export async function updateAward(id: number, patch: { name?: string; count?: number }) {
  if (patch.name != null) await q(sql`UPDATE roundAwards SET name=${patch.name} WHERE id=${id}`);
  if (patch.count != null) await q(sql`UPDATE roundAwards SET count=${patch.count} WHERE id=${id}`);
}
export async function renameRound(seasonId: number, name: string) { await q(sql`UPDATE seasons SET name=${name} WHERE id=${seasonId}`); }

/* ---------- 이게돼 ---------- */
export async function createItge(userId: number, date: string, content: string) {
  let summary = content.replace(/\s+/g, " ").slice(0, 28);
  try {
    const r: any = await invokeLLM({ messages: [
      { role: "system", content: "다이어트 커뮤니티 후기 글을 20자 안팎의 한국어 한 줄로 요약합니다. 따옴표·이모지 없이 핵심만." },
      { role: "user", content },
    ] } as any);
    const c = r?.choices?.[0]?.message?.content;
    if (typeof c === "string" && c.trim()) summary = c.trim().replace(/^["']|["']$/g, "").split("\n")[0].slice(0, 60);
  } catch (e) { console.warn("[itge] summary failed", e); }
  await q(sql`INSERT INTO itgeNotes (userId, recordedDate, content, summary) VALUES (${userId}, ${date}, ${content}, ${summary})`);
  const range = await countRange();
  const c = await itemCounts(userId, range.since, range.until);
  return { summary, count: c.itge };
}

export async function listItge(userId: number) {
  return q(sql`SELECT id, userId, DATE_FORMAT(recordedDate,'%Y-%m-%d') recordedDate, content, summary, DATE_FORMAT(CONVERT_TZ(createdAt,'+00:00','+09:00'),'%Y-%m-%d %H:%i') createdAt FROM itgeNotes WHERE userId=${userId} ORDER BY createdAt DESC`);
}

export async function itgeCrew() {
  const users = await db.listApprovedUsers();
  const counts = await q(sql`SELECT userId, COUNT(*) c FROM itgeNotes GROUP BY userId`);
  const m = new Map(counts.map(r => [Number(r.userId), Number(r.c)]));
  return users.map(u => ({ userId: u.id, name: u.name ?? "멤버", count: m.get(u.id) ?? 0 })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* ---------- 1년 미션 클리어: 날짜별 기상·식단 여부 ---------- */
export async function dayFlags(userId: number, since: string, until: string) {
  const wake = await q(sql`SELECT DISTINCT DATE_FORMAT(recordedDate,'%Y-%m-%d') d FROM sleeps WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until}`);
  const meal = await q(sql`SELECT DISTINCT DATE_FORMAT(recordedDate,'%Y-%m-%d') d FROM meals WHERE userId=${userId} AND recordedDate BETWEEN ${since} AND ${until}`);
  return { wake: wake.map(r => r.d as string), meal: meal.map(r => r.d as string) };
}

/* ---------- 활동명 중복 검사 ---------- */
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
export async function checkNickname(name: string, selfId?: number) {
  const n = norm(name);
  if (n.length < 2) return { ok: false, reason: "두 글자 이상 써 주세요.", similar: [] as string[] };
  const users = await db.listApprovedUsers();
  const similar = users.filter(u => u.id !== selfId && u.name).map(u => u.name as string)
    .filter(other => { const o = norm(other); return o === n || o.includes(n) || n.includes(o); });
  return { ok: similar.length === 0, reason: similar.length ? "이미 쓰는 이름이거나 너무 비슷해요." : "", similar };
}
