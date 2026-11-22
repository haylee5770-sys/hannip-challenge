// 시즌 운영 (2026-11-22)
// - 시즌: 이름(예: 2026 파이널 시즌, 슈퍼루틴 2027 시즌 1) · 짧은 이름(26 파이널, 27-1) · 시작~끝 · (있으면) 3일 디톡스 날짜
// - 참여 선택: 시즌이 시작되면 크루가 '3일 디톡스' 또는 '슈퍼루틴(시즌 전체)' 중 하나를 고른다. 상은 슈퍼루틴만
// - 테스트 기간 기록은 지우지 않고, 번호·시상·나의 변화는 시즌 시작일부터만 센다
// - 의견 보내기 · 선물/이벤트 신청 · MVP
import { sql } from "drizzle-orm";
import * as db from "./db";
import { addDays } from "./seasons";
import { kstToday } from "./rounds";

function rowsOf(res: any): any[] { return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : []; }
async function q(query: any): Promise<any[]> { const conn = await db.getDb(); if (!conn) return []; return rowsOf(await conn.execute(query)); }
const d10 = (v: any) => (v == null ? null : (v instanceof Date ? new Date(v.getTime() + 9 * 3600_000).toISOString() : String(v)).slice(0, 10));

export async function ensureSeasonPlusSchema() {
  const stmts: Array<[string, string]> = [
    ["ALTER TABLE seasons ADD COLUMN IF NOT EXISTS shortName VARCHAR(32) NOT NULL DEFAULT ''", "seasons.shortName"],
    ["ALTER TABLE seasons ADD COLUMN IF NOT EXISTS planEnd DATE", "seasons.planEnd"],
    ["ALTER TABLE seasons ADD COLUMN IF NOT EXISTS detoxStart DATE", "seasons.detoxStart"],
    ["ALTER TABLE seasons ADD COLUMN IF NOT EXISTS detoxEnd DATE", "seasons.detoxEnd"],
    [`CREATE TABLE IF NOT EXISTS seasonEntries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seasonId INT NOT NULL,
      userId INT NOT NULL,
      track VARCHAR(16) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY seasonEntries_u (seasonId, userId)
    )`, "seasonEntries"],
    [`CREATE TABLE IF NOT EXISTS feedbacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      kind VARCHAR(16) NOT NULL,
      text TEXT NOT NULL,
      imageUrl TEXT,
      done BOOLEAN NOT NULL DEFAULT false,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, "feedbacks"],
    [`CREATE TABLE IF NOT EXISTS giftRequests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      kind VARCHAR(16) NOT NULL,
      label VARCHAR(200) NOT NULL,
      refId INT,
      realName VARCHAR(64) NOT NULL DEFAULT '',
      phone VARCHAR(32) NOT NULL DEFAULT '',
      address TEXT,
      sent BOOLEAN NOT NULL DEFAULT false,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, "giftRequests"],
    [`CREATE TABLE IF NOT EXISTS openEvents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      open BOOLEAN NOT NULL DEFAULT true,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, "openEvents"],
  ];
  for (const [s, label] of stmts) {
    try { await q(sql.raw(s)); console.log("[ensureSchema] ok", label); }
    catch (e: any) { console.warn("[ensureSchema] skip", label, (e?.cause?.message ?? e?.message ?? "").slice(0, 120)); }
  }
}

/* ---------- 시즌 ---------- */
export type SeasonInfo = { id: number; name: string; shortName: string; startDate: string; planEnd: string | null; detoxStart: string | null; detoxEnd: string | null; status: string };
const toInfo = (s: any): SeasonInfo => ({ id: Number(s.id), name: s.name, shortName: s.shortName ?? "", startDate: d10(s.startDate)!, planEnd: d10(s.planEnd), detoxStart: d10(s.detoxStart), detoxEnd: d10(s.detoxEnd), status: s.status });

export async function activeSeasonInfo(): Promise<SeasonInfo | null> {
  const r = (await q(sql`SELECT * FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1`))[0];
  return r ? toInfo(r) : null;
}
export async function allSeasonInfos(): Promise<SeasonInfo[]> {
  return (await q(sql`SELECT * FROM seasons ORDER BY startDate ASC, id ASC`)).map(toInfo);
}

/** 방장이 시즌 시작 (진행 중 회차가 있으면 먼저 종료·결산) */
export async function startSeason(adminId: number, input: { name: string; shortName: string; planEnd: string; detoxStart?: string | null; detoxEnd?: string | null }, endCurrent: () => Promise<any>) {
  const cur = await activeSeasonInfo();
  if (cur) await endCurrent();
  const all = await db.listSeasons();
  const n = all.reduce((m: number, s: any) => Math.max(m, s.seasonNumber ?? 0), 0) + 1;
  const today = kstToday();
  const id = await db.createSeason({ seasonNumber: n, totalDays: 365, name: input.name, startDate: today, endDate: addDays(today, 364), status: "active", createdByUserId: adminId } as any);
  await q(sql`UPDATE seasons SET roundType='season', shortName=${input.shortName}, planEnd=${input.planEnd}, detoxStart=${input.detoxStart || null}, detoxEnd=${input.detoxEnd || null} WHERE id=${id}`);
  return { id, seasonNumber: n };
}

export async function myEntry(userId: number) {
  const s = await activeSeasonInfo();
  if (!s) return { season: null, track: null as string | null };
  const r = (await q(sql`SELECT track FROM seasonEntries WHERE seasonId=${s.id} AND userId=${userId}`))[0];
  return { season: s, track: (r?.track as string | undefined) ?? null };
}
export async function join(userId: number, track: "detox" | "routine") {
  const s = await activeSeasonInfo();
  if (!s) return { ok: false };
  await q(sql`INSERT INTO seasonEntries (seasonId, userId, track) VALUES (${s.id}, ${userId}, ${track}) ON DUPLICATE KEY UPDATE track=${track}`);
  return { ok: true };
}
/** 상 받을 수 있는 사람(슈퍼루틴 참여자). 참여 기록이 아예 없는 예전 회차면 null = 모두 */
export async function routineUserIds(seasonId: number): Promise<Set<number> | null> {
  const rows = await q(sql`SELECT userId, track FROM seasonEntries WHERE seasonId=${seasonId}`);
  if (!rows.length) return null;
  return new Set(rows.filter(r => r.track === "routine").map(r => Number(r.userId)));
}
export async function entryCounts(seasonId: number) {
  const rows = await q(sql`SELECT track, COUNT(*) c FROM seasonEntries WHERE seasonId=${seasonId} GROUP BY track`);
  const m = Object.fromEntries(rows.map(r => [r.track, Number(r.c)]));
  return { detox: m.detox ?? 0, routine: m.routine ?? 0 };
}

/** 시즌별 체중: 시즌 시작 때 한 번 + 끝나기 전 마지막 3일에 한 번 */
export async function weighStatus(userId: number) {
  const s = await activeSeasonInfo();
  if (!s) return { need: null as null | "start" | "end" };
  const today = kstToday();
  const hasStart = Number((await q(sql`SELECT COUNT(*) c FROM weights WHERE userId=${userId} AND recordedDate >= ${s.startDate}`))[0]?.c ?? 0) > 0;
  if (!hasStart) return { need: "start" as const };
  if (s.planEnd && today >= addDays(s.planEnd, -2) && today <= s.planEnd) {
    const hasEnd = Number((await q(sql`SELECT COUNT(*) c FROM weights WHERE userId=${userId} AND recordedDate >= ${addDays(s.planEnd, -2)}`))[0]?.c ?? 0) > 0;
    if (!hasEnd) return { need: "end" as const };
  }
  return { need: null };
}

/* ---------- MVP (방장이 뽑음) ---------- */
export async function setMvp(seasonId: number, userId: number, name: string) {
  await q(sql`DELETE FROM roundAwards WHERE seasonId=${seasonId} AND kind='mvp'`);
  await q(sql`INSERT INTO roundAwards (seasonId, kind, rankNo, userId, name, count) VALUES (${seasonId}, 'mvp', 1, ${userId}, ${name}, 0)`);
}

/* ---------- 의견 보내기 ---------- */
export async function addFeedback(userId: number, kind: "bug" | "idea", text: string, imageUrl: string | null) {
  await q(sql`INSERT INTO feedbacks (userId, kind, text, imageUrl) VALUES (${userId}, ${kind}, ${text}, ${imageUrl})`);
}
export async function listFeedbacks() {
  return q(sql`SELECT f.id, f.kind, f.text, f.imageUrl, f.done, f.createdAt, u.name FROM feedbacks f LEFT JOIN users u ON u.id=f.userId ORDER BY f.id DESC LIMIT 300`);
}
export async function setFeedbackDone(id: number, done: boolean) { await q(sql`UPDATE feedbacks SET done=${done} WHERE id=${id}`); }

/* ---------- 선물·이벤트 신청 ---------- */
const AWARD_LABEL: Record<string, string> = { itge: "이게돼 챔피언", total: "꾸준함 챔피언", mvp: "MVP" };
/** 내가 받을 수 있는 선물: 끝난 시즌에서 1등으로 뽑힌 상 */
export async function myGifts(userId: number) {
  const rows = await q(sql`SELECT a.id, a.kind, a.seasonId, s.name sname FROM roundAwards a JOIN seasons s ON s.id=a.seasonId
    WHERE a.userId=${userId} AND a.rankNo=1 AND s.status='ended' ORDER BY a.id DESC LIMIT 20`);
  const done = new Set((await q(sql`SELECT refId FROM giftRequests WHERE userId=${userId} AND kind='gift'`)).map(r => Number(r.refId)));
  return rows.map(r => ({ awardId: Number(r.id), label: `${r.sname} ${AWARD_LABEL[r.kind] ?? r.kind}`, requested: done.has(Number(r.id)) }));
}
export async function listOpenEvents(onlyOpen = true) {
  return onlyOpen ? q(sql`SELECT id, title, open FROM openEvents WHERE open=true ORDER BY id DESC`) : q(sql`SELECT id, title, open FROM openEvents ORDER BY id DESC`);
}
export async function addEvent(title: string) { await q(sql`INSERT INTO openEvents (title) VALUES (${title})`); }
export async function setEventOpen(id: number, open: boolean) { await q(sql`UPDATE openEvents SET open=${open} WHERE id=${id}`); }
export async function myEventIds(userId: number) {
  return (await q(sql`SELECT refId FROM giftRequests WHERE userId=${userId} AND kind='event'`)).map(r => Number(r.refId));
}
export async function addRequest(userId: number, d: { kind: "gift" | "event"; refId: number; label: string; realName: string; phone: string; address: string }) {
  await q(sql`INSERT INTO giftRequests (userId, kind, label, refId, realName, phone, address) VALUES (${userId}, ${d.kind}, ${d.label}, ${d.refId}, ${d.realName}, ${d.phone}, ${d.address})`);
}
export async function listRequests() {
  return q(sql`SELECT g.id, g.kind, g.label, g.realName, g.phone, g.address, g.sent, g.createdAt, u.name nickname FROM giftRequests g LEFT JOIN users u ON u.id=g.userId ORDER BY g.id DESC LIMIT 500`);
}
export async function setRequestSent(id: number, sent: boolean) { await q(sql`UPDATE giftRequests SET sent=${sent} WHERE id=${id}`); }

/* 2026-11-22 개편: 상 받기 신청(상 3개 버튼) · 이벤트 참여(누르면 바로 완료 + 신청자 릴레이) */
export const AWARD_KINDS = [
  { code: 1, kind: "itge", title: "이게돼 챔피언", gift: "스무디 15개" },
  { code: 2, kind: "total", title: "꾸준함 챔피언", gift: "스무디 3종" },
  { code: 3, kind: "mvp", title: "MVP", gift: "네이버페이 1만 원권" },
];
/** 최근 시상한 시즌 이름 + 내가 이미 신청한 상 */
export async function awardOptions(userId: number) {
  const s = (await q(sql`SELECT id, name FROM seasons WHERE status='ended' ORDER BY endDate DESC, id DESC LIMIT 1`))[0]
    ?? (await q(sql`SELECT id, name FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1`))[0];
  const seasonName = s?.name ?? "";
  const mine = await q(sql`SELECT refId, label FROM giftRequests WHERE userId=${userId} AND kind='gift'`);
  const done = new Set(mine.filter(r => String(r.label).includes(seasonName)).map(r => Number(r.refId)));
  return { seasonName, awards: AWARD_KINDS.map(a => ({ ...a, requested: done.has(a.code) })) };
}
/** 이벤트 목록 (열린 것 먼저, 그다음 지난 것 날짜순) + 신청자 수 + 내가 신청했는지 */
export async function eventBoard(userId: number) {
  const evs = await q(sql`SELECT e.id, e.title, e.open, DATE_FORMAT(CONVERT_TZ(e.createdAt,'+00:00','+09:00'),'%Y-%m-%d') d,
      (SELECT COUNT(*) FROM giftRequests g WHERE g.kind='event' AND g.refId=e.id) cnt,
      (SELECT COUNT(*) FROM giftRequests g WHERE g.kind='event' AND g.refId=e.id AND g.userId=${userId}) mine
    FROM openEvents e ORDER BY e.open DESC, e.id DESC LIMIT 100`);
  return evs.map(e => ({ id: Number(e.id), title: e.title, open: !!e.open, date: e.d, count: Number(e.cnt), joined: Number(e.mine) > 0 }));
}
/** 신청한 순서대로 이름 (릴레이) */
export async function eventApplicants(eventId: number) {
  const rows = await q(sql`SELECT g.id, u.name, g.createdAt FROM giftRequests g LEFT JOIN users u ON u.id=g.userId WHERE g.kind='event' AND g.refId=${eventId} ORDER BY g.id ASC`);
  return rows.map((r, i) => ({ no: i + 1, name: r.name ?? "멤버" }));
}
export async function joinEvent(userId: number, eventId: number) {
  const ev = (await q(sql`SELECT id, title, open FROM openEvents WHERE id=${eventId}`))[0];
  if (!ev || !ev.open) return { ok: false, message: "마감된 이벤트예요." };
  const ex = (await q(sql`SELECT id FROM giftRequests WHERE kind='event' AND refId=${eventId} AND userId=${userId}`))[0];
  if (!ex) {
    const u = (await q(sql`SELECT realName, phone, address FROM users WHERE id=${userId}`))[0] ?? {};
    await q(sql`INSERT INTO giftRequests (userId, kind, label, refId, realName, phone, address) VALUES (${userId}, 'event', ${ev.title}, ${eventId}, ${u.realName ?? ""}, ${u.phone ?? ""}, ${u.address ?? null})`);
  }
  return { ok: true };
}
