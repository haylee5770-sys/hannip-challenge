// 크루 명단 (2026-11-22): 방장이 이름·전화번호·닉네임(·주소)을 미리 넣어 두면,
// 가입할 때 이름+전화번호가 맞는 사람은 방장 수락 없이 바로 입장한다.
// 명단에 없는 사람은 정보를 다 적고 '승인 대기'로 간다.
// ⚠️ 저장소가 공개라서 명단(개인정보)은 코드에 넣지 않고 관리 화면에서 붙여 넣는다.
import { sql } from "drizzle-orm";
import * as db from "./db";

function rowsOf(res: any): any[] { return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : []; }
async function q(query: any): Promise<any[]> { const conn = await db.getDb(); if (!conn) return []; return rowsOf(await conn.execute(query)); }

export async function ensureRosterSchema() {
  const stmts: Array<[string, string]> = [
    [`CREATE TABLE IF NOT EXISTS roster (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nickname VARCHAR(64) NOT NULL,
      realName VARCHAR(64) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      address TEXT,
      usedByUserId INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, "roster"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT", "users.address"],
    [`CREATE TABLE IF NOT EXISTS adminNotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      text TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY adminNotes_user (userId)
    )`, "adminNotes"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS contactEmail VARCHAR(320)", "users.contactEmail"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS privacyAgreed BOOLEAN NOT NULL DEFAULT false", "users.privacyAgreed"],
  ];
  for (const [s, label] of stmts) {
    try { await q(sql.raw(s)); console.log("[ensureSchema] ok", label); }
    catch (e: any) { console.warn("[ensureSchema] skip", label, (e?.cause?.message ?? e?.message ?? "").slice(0, 120)); }
  }
}

/** 전화번호는 숫자만 남긴다 (010-1234-5678 → 01012345678) */
export const normPhone = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
/** 이름은 띄어쓰기만 없앤다 */
export const normName = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "");
const fmtPhone = (d: string) => d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d;

export async function findRosterMatch(name: string, phone: string) {
  const p = normPhone(phone), n = normName(name);
  if (!p || !n) return null;
  const rows = await q(sql`SELECT id, nickname, realName, phone, address, usedByUserId FROM roster WHERE phone = ${p}`);
  return rows.find(r => normName(r.realName) === n) ?? null;
}

export async function markRosterUsed(id: number, userId: number) {
  await q(sql`UPDATE roster SET usedByUserId = ${userId} WHERE id = ${id}`);
}

export async function listRoster() {
  const rows = await q(sql`SELECT r.id, r.nickname, r.realName, r.phone, r.address, r.usedByUserId, u.name AS userName, u.email AS userEmail
    FROM roster r LEFT JOIN users u ON u.id = r.usedByUserId ORDER BY r.id`);
  return rows.map(r => ({ ...r, phone: fmtPhone(String(r.phone)) }));
}

/**
 * 붙여 넣은 글을 명단으로. 한 줄에 한 사람: 닉네임, 이름, 전화번호, 주소(선택)
 * 쉼표·탭 둘 다 된다. 같은 전화번호가 이미 있으면 새 내용으로 바꾼다.
 */
export async function importRoster(text: string) {
  let added = 0, updated = 0; const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith("#")) continue;
    const parts = (line.includes("\t") ? line.split("\t") : line.split(",")).map(s => s.trim());
    const [nickname, realName, phone, ...rest] = parts;
    const address = rest.join(", ").trim();
    const p = normPhone(phone);
    if (!nickname || !realName || p.length < 10) { skipped.push(line.slice(0, 40)); continue; }
    const ex = (await q(sql`SELECT id FROM roster WHERE phone = ${p}`))[0];
    if (ex) { await q(sql`UPDATE roster SET nickname=${nickname}, realName=${realName}, address=${address || null} WHERE id=${ex.id}`); updated++; }
    else { await q(sql`INSERT INTO roster (nickname, realName, phone, address) VALUES (${nickname}, ${realName}, ${p}, ${address || null})`); added++; }
  }
  return { added, updated, skipped };
}

export async function deleteRoster(id: number) { await q(sql`DELETE FROM roster WHERE id = ${id}`); }

/** 가입 때 받은 주소·연락 이메일·개인정보 동의 저장 */
export async function saveSignupExtras(userId: number, d: { address?: string | null; contactEmail?: string | null; privacyAgreed: boolean }) {
  await q(sql`UPDATE users SET address = ${d.address ?? null}, contactEmail = ${d.contactEmail ?? null}, privacyAgreed = ${d.privacyAgreed} WHERE id = ${userId}`);
}

export async function getUserExtras(userIds: number[]) {
  if (!userIds.length) return new Map<number, { address: string | null; contactEmail: string | null }>();
  const rows = await q(sql`SELECT id, address, contactEmail FROM users WHERE id IN (${sql.join(userIds.map(i => sql`${i}`), sql`, `)})`);
  return new Map(rows.map(r => [Number(r.id), { address: r.address ?? null, contactEmail: r.contactEmail ?? null }]));
}

export async function getMyContact(userId: number) {
  const r = (await q(sql`SELECT realName, phone, address FROM users WHERE id = ${userId}`))[0];
  return { realName: r?.realName ?? "", phone: r?.phone ?? "", address: r?.address ?? "" };
}
export async function updateMyContact(userId: number, d: { phone: string; address: string }) {
  await q(sql`UPDATE users SET phone = ${d.phone}, address = ${d.address} WHERE id = ${userId}`);
}

/* 방장 메모 (2026-11-22): 멤버마다 날짜별로 쌓이는 특이사항. 방장만 본다 */
export async function listAdminNotes(userId: number) {
  return q(sql`SELECT id, text, createdAt FROM adminNotes WHERE userId = ${userId} ORDER BY id DESC`);
}
export async function addAdminNote(userId: number, text: string) { await q(sql`INSERT INTO adminNotes (userId, text) VALUES (${userId}, ${text})`); }
export async function deleteAdminNote(id: number) { await q(sql`DELETE FROM adminNotes WHERE id = ${id}`); }
