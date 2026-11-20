// 시크릿 입장 코드 (2026-11-21): 무작위 코드가 정해진 날짜마다 저절로 바뀐다. 방장은 관리 > 입장코드에서 지금 코드를 보고 크루에게 알려 준다.
import { sql } from "drizzle-orm";
import * as db from "./db";

function rowsOf(res: any): any[] { return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : []; }
async function q(query: any): Promise<any[]> { const conn = await db.getDb(); if (!conn) return []; return rowsOf(await conn.execute(query)); }

export async function ensureEntryCodeSchema() {
  try {
    await q(sql.raw(`CREATE TABLE IF NOT EXISTS entryCodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(16) NOT NULL,
      days INT NOT NULL DEFAULT 14,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`));
    console.log("[ensureSchema] ok entryCodes");
  } catch (e: any) { console.warn("[ensureSchema] skip entryCodes", e?.message); }
}

// 헷갈리는 글자(0·O·1·I·L) 빼고 6자리
const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode() { let s = ""; for (let i = 0; i < 6; i++) s += ABC[Math.floor(Math.random() * ABC.length)]; return s; }

export async function currentEntryCode(): Promise<{ code: string; days: number; createdAt: string; nextChange: string }> {
  let r = (await q(sql`SELECT code, days, createdAt FROM entryCodes ORDER BY id DESC LIMIT 1`))[0];
  const now = Date.now();
  const expired = r ? now - new Date(r.createdAt).getTime() > Number(r.days) * 86400_000 : true;
  if (!r || expired) {
    const days = r ? Number(r.days) : 14;
    await q(sql`INSERT INTO entryCodes (code, days) VALUES (${makeCode()}, ${days})`);
    r = (await q(sql`SELECT code, days, createdAt FROM entryCodes ORDER BY id DESC LIMIT 1`))[0];
  }
  const created = new Date(r.createdAt).getTime();
  const next = new Date(created + Number(r.days) * 86400_000 + 9 * 3600_000).toISOString().slice(0, 10);
  return { code: String(r.code), days: Number(r.days), createdAt: new Date(created + 9 * 3600_000).toISOString().slice(0, 10), nextChange: next };
}

/** 방장이 지금 바로 새 코드로 바꾸거나, 바뀌는 간격(일)을 정한다 */
export async function rotateEntryCode(days?: number) {
  const cur = (await q(sql`SELECT days FROM entryCodes ORDER BY id DESC LIMIT 1`))[0];
  const d = days ?? (cur ? Number(cur.days) : 14);
  await q(sql`INSERT INTO entryCodes (code, days) VALUES (${makeCode()}, ${d})`);
  return currentEntryCode();
}

export async function entryCodeOk(input: string): Promise<boolean> {
  const v = (input ?? "").replace(/\s+/g, "").toUpperCase();
  if (!v) return false;
  const c = await currentEntryCode();
  return v === c.code;
}
