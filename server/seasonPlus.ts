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
    // 2026-11-23: 의견에 방장 답장
    ["ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS reply TEXT", "feedbacks.reply"],
    ["ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS repliedAt TIMESTAMP NULL", "feedbacks.repliedAt"],
    ["ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS replySeen BOOLEAN NOT NULL DEFAULT false", "feedbacks.replySeen"],
    ["ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS editedAt TIMESTAMP NULL", "feedbacks.editedAt"],
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

/* ---------- 시즌 시작 시간 예약 (2026-11-23 해이: 새벽 4시처럼 잠든 시간에 시작) ---------- */
export type SeasonPlan = { name: string; shortName: string; planEnd: string; detoxStart?: string | null; detoxEnd?: string | null };
type Scheduled = SeasonPlan & { startAt: string; adminId: number };
const SCHED_KEY = "season.scheduled";
// 그날 0시~시작 시각 사이에 올린 기록은 전날로 옮겨 새 시즌 번호에 안 들어가게 한다 (지우지 않음)
const DATED_TABLES = ["meals", "waters", "exercises", "sleeps", "weights", "itgeNotes", "happyNotes", "dailyConditions"];

export async function getScheduledSeason(): Promise<Scheduled | null> {
  const { getState } = await import("./purchases");
  const v = await getState(SCHED_KEY).catch(() => null);
  if (!v) return null;
  try { return JSON.parse(v) as Scheduled; } catch { return null; }
}
export async function scheduleSeason(adminId: number, plan: SeasonPlan, startAtIso: string) {
  const t = new Date(startAtIso);
  if (!Number.isFinite(t.getTime())) throw new Error("시작 시각이 올바르지 않아요.");
  if (t.getTime() < Date.now() + 60_000) throw new Error("지금보다 1분 이상 뒤로 예약해 주세요.");
  const { setState } = await import("./purchases");
  await setState(SCHED_KEY, JSON.stringify({ ...plan, startAt: t.toISOString(), adminId } satisfies Scheduled));
  return { ok: true };
}
export async function cancelScheduledSeason() {
  const { setState } = await import("./purchases");
  await setState(SCHED_KEY, "");
  return { ok: true };
}

let schedBusy = false;
/** 예약 시각이 지났으면 시즌을 시작한다. 서버가 다시 켜져도 예약은 DB에 남아 있어서 이어서 동작 */
export async function runDueScheduledSeason(endCurrent: () => Promise<any>) {
  if (schedBusy) return;
  const s = await getScheduledSeason();
  if (!s || Date.now() < new Date(s.startAt).getTime()) return;
  schedBusy = true;
  const { setState } = await import("./purchases");
  try {
    await setState(SCHED_KEY, ""); // 두 번 시작되지 않게 먼저 지운다
    const r = await startSeason(s.adminId, s, endCurrent, new Date(s.startAt));
    const msg = `${new Date().toISOString()} 예약 시작 완료 · 시즌 ${r.seasonNumber} '${s.name}' · 시작 전 기록 전날로: ${r.moved.join(", ") || "없음"}`;
    await setState("season.lastScheduledRun", msg);
    console.log("[season schedule]", msg);
  } catch (e: any) {
    await setState("season.lastScheduledRun", `${new Date().toISOString()} 예약 시작 실패: ${e?.message ?? e}`).catch(() => {});
    console.error("[season schedule] failed", e);
  } finally { schedBusy = false; }
}
export function startSeasonScheduleTimer(endCurrent: () => Promise<any>) {
  void runDueScheduledSeason(endCurrent);
  setInterval(() => void runDueScheduledSeason(endCurrent), 30_000);
}

/** 방장이 시즌 시작 (진행 중 회차가 있으면 먼저 종료·결산) */
/** 시즌 시작 순간 '딱 끊기' (2026-11-24 해이): 시작 날짜에 시작 시각 전에 올린 기록은 전날로 옮겨서 새 시즌에 안 섞이게 (지우지 않음) */
async function cutBefore(startDate: string, cutAt: Date) {
  const epoch = Math.floor(cutAt.getTime() / 1000);
  const moved: string[] = [];
  for (const t of DATED_TABLES) {
    try {
      const res: any = await (await db.getDb())!.execute(sql`UPDATE IGNORE ${sql.raw(t)} SET recordedDate = DATE_SUB(recordedDate, INTERVAL 1 DAY)
        WHERE recordedDate = ${startDate} AND UNIX_TIMESTAMP(createdAt) < ${epoch}`);
      const n = Number(res?.[0]?.affectedRows ?? 0);
      if (n) moved.push(`${t} ${n}`);
    } catch (e: any) { console.warn("[season cut] skip", t, (e?.message ?? "").slice(0, 100)); }
  }
  return moved;
}

/** 방장이 시즌 시작 (진행 중 회차가 있으면 먼저 종료·결산). 누른 순간(또는 예약 시각)에 딱 끊는다 */
export async function startSeason(adminId: number, input: { name: string; shortName: string; planEnd: string; detoxStart?: string | null; detoxEnd?: string | null }, endCurrent: () => Promise<any>, cutAt: Date = new Date()) {
  const cur = await activeSeasonInfo();
  if (cur) await endCurrent();
  const all = await db.listSeasons();
  const n = all.reduce((m: number, s: any) => Math.max(m, s.seasonNumber ?? 0), 0) + 1;
  const today = kstToday();
  const id = await db.createSeason({ seasonNumber: n, totalDays: 365, name: input.name, startDate: today, endDate: addDays(today, 364), status: "active", createdByUserId: adminId } as any);
  await q(sql`UPDATE seasons SET roundType='season', shortName=${input.shortName}, planEnd=${input.planEnd}, detoxStart=${input.detoxStart || null}, detoxEnd=${input.detoxEnd || null} WHERE id=${id}`);
  const moved = await cutBefore(today, cutAt);
  console.log("[season start]", input.name, "cut", cutAt.toISOString(), "moved", moved.join(", ") || "none");
  return { id, seasonNumber: n, moved };
}

/**
 * 지금 진행 중인 시즌 이름 바꾸기 (2026-11-24 해이: 시험으로 눌러 본 시즌을 '테스트 시즌 (삭제될 예정)'으로 남기기)
 */
export async function renameActiveSeason(name: string, shortName: string) {
  const cur = await activeSeasonInfo();
  if (!cur) return { ok: false };
  await q(sql`UPDATE seasons SET name=${name}, shortName=${shortName} WHERE id=${cur.id}`);
  return { ok: true };
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
  return q(sql`SELECT f.id, f.kind, f.text, f.imageUrl, f.done, f.createdAt, f.reply, f.repliedAt, f.editedAt, u.name FROM feedbacks f LEFT JOIN users u ON u.id=f.userId ORDER BY f.id DESC LIMIT 300`);
}
/** 방장 답장 (2026-11-23). 답장하면 '확인함'도 같이 켜고, 크루에게는 새 답장으로 보이게 */
export async function replyFeedback(id: number, reply: string) {
  const r = reply.trim();
  if (r) await q(sql`UPDATE feedbacks SET reply=${r}, repliedAt=CURRENT_TIMESTAMP, replySeen=false, done=true WHERE id=${id}`);
  else await q(sql`UPDATE feedbacks SET reply=NULL, repliedAt=NULL, replySeen=false WHERE id=${id}`);
}
/** 크루가 자기 의견 지우기 (2026-11-23) — 방장이 아직 '확인함'·답장 안 한 것만 */
export async function deleteMyFeedback(userId: number, id: number) {
  const row = (await q(sql`SELECT done, reply FROM feedbacks WHERE id=${id} AND userId=${userId}`))[0];
  if (!row) return { ok: false, message: "의견을 찾을 수 없어요." };
  if (row.done || row.reply) return { ok: false, message: "방장이 이미 확인한 의견이라 지울 수 없어요." };
  await q(sql`DELETE FROM feedbacks WHERE id=${id} AND userId=${userId} AND done=false AND reply IS NULL`);
  return { ok: true, message: "" };
}
/** 크루가 내 의견 화면을 열면 답장을 '봤음'으로 */
export async function markRepliesSeen(userId: number) {
  await q(sql`UPDATE feedbacks SET replySeen=true WHERE userId=${userId} AND reply IS NOT NULL AND replySeen=false`);
}
export async function unseenReplyCount(userId: number) {
  return Number((await q(sql`SELECT COUNT(*) c FROM feedbacks WHERE userId=${userId} AND reply IS NOT NULL AND replySeen=false`))[0]?.c ?? 0);
}
export async function setFeedbackDone(id: number, done: boolean) { await q(sql`UPDATE feedbacks SET done=${done} WHERE id=${id}`); }
/** 내가 보낸 의견 목록 (2026-11-23: 보낸 뒤에도 다시 보고 고칠 수 있게) */
export async function myFeedbacks(userId: number) {
  return q(sql`SELECT id, kind, text, imageUrl, done, createdAt, reply, repliedAt, replySeen FROM feedbacks WHERE userId=${userId} ORDER BY id DESC LIMIT 100`);
}
/** 내 의견 고치기 — 본인 것만. 고치면 방장이 다시 보도록 '확인' 표시를 푼다 */
export async function editFeedback(userId: number, id: number, kind: "bug" | "idea", text: string, image: { url: string | null } | undefined) {
  if (image) await q(sql`UPDATE feedbacks SET kind=${kind}, text=${text}, imageUrl=${image.url}, done=false, editedAt=CURRENT_TIMESTAMP WHERE id=${id} AND userId=${userId}`);
  else await q(sql`UPDATE feedbacks SET kind=${kind}, text=${text}, done=false, editedAt=CURRENT_TIMESTAMP WHERE id=${id} AND userId=${userId}`);
}

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
  // 2026-11-23: 새 앱 이전 시험용 회차(10.5기 미니 챌린지 시험 등)는 빼고 찾는다. 없으면 이번 파이널 시즌
  const s = (await q(sql`SELECT id, name FROM seasons WHERE status='ended' AND startDate >= '2026-11-20' ORDER BY endDate DESC, id DESC LIMIT 1`))[0]
    ?? (await q(sql`SELECT id, name FROM seasons WHERE status='active' AND startDate >= '2026-11-20' ORDER BY id DESC LIMIT 1`))[0];
  const seasonName = s?.name ?? "2026 파이널 시즌";
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
