// 구매 기록 (2026-11-22): 스마트스토어 주문을 전화번호로 크루와 이어 준다. 방장만 본다.
// - 예전 주문: 주문서 엑셀을 정리한 파일을 관리 화면에서 올린다 (공개 저장소라 개인정보는 코드에 넣지 않는다)
// - 앞으로 주문: 네이버 커머스 API로 하루 1번 자동으로 가져온다 (naverCommerce.ts)
import { sql } from "drizzle-orm";
import * as db from "./db";
import { normPhone } from "./roster";

function rowsOf(res: any): any[] { return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : []; }
async function q(query: any): Promise<any[]> { const conn = await db.getDb(); if (!conn) return []; return rowsOf(await conn.execute(query)); }

export async function ensurePurchaseSchema() {
  const stmts: Array<[string, string]> = [
    [`CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(8) NOT NULL,
      dedupeKey VARCHAR(191) NOT NULL,
      orderNo VARCHAR(40),
      orderDate VARCHAR(10),
      buyerName VARCHAR(64),
      buyerPhone VARCHAR(20),
      recvName VARCHAR(64),
      recvPhone VARCHAR(20),
      product TEXT,
      opt TEXT,
      qty INT NOT NULL DEFAULT 1,
      amount INT,
      kind VARCHAR(8) NOT NULL DEFAULT '구매',
      status VARCHAR(32),
      note VARCHAR(120),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY purchases_key (dedupeKey),
      KEY purchases_bp (buyerPhone),
      KEY purchases_rp (recvPhone)
    )`, "purchases"],
    [`CREATE TABLE IF NOT EXISTS syncState (
      name VARCHAR(32) PRIMARY KEY,
      value TEXT,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`, "syncState"],
  ];
  for (const [s, label] of stmts) {
    try { await q(sql.raw(s)); console.log("[ensureSchema] ok", label); }
    catch (e: any) { console.warn("[ensureSchema] skip", label, (e?.cause?.message ?? e?.message ?? "").slice(0, 120)); }
  }
}

export async function getState(name: string) { return (await q(sql`SELECT value FROM syncState WHERE name = ${name}`))[0]?.value ?? null; }
export async function setState(name: string, value: string) {
  await q(sql`INSERT INTO syncState (name, value) VALUES (${name}, ${value}) ON DUPLICATE KEY UPDATE value = VALUES(value)`);
}

export type PurchaseRow = {
  source: "excel" | "naver"; dedupeKey: string; orderNo?: string | null; orderDate?: string | null;
  buyerName?: string | null; buyerPhone?: string | null; recvName?: string | null; recvPhone?: string | null;
  product?: string | null; opt?: string | null; qty?: number; amount?: number | null; kind?: string; status?: string | null; note?: string | null;
};

/** 있으면 고치고(상태·금액), 없으면 넣는다. 새로 들어간 줄이면 true */
export async function upsertPurchase(p: PurchaseRow) {
  const ex = (await q(sql`SELECT id FROM purchases WHERE dedupeKey = ${p.dedupeKey}`))[0];
  if (ex) {
    await q(sql`UPDATE purchases SET status = ${p.status ?? null}, kind = ${p.kind ?? "구매"}, amount = COALESCE(${p.amount ?? null}, amount) WHERE id = ${ex.id}`);
    return false;
  }
  await q(sql`INSERT INTO purchases (source, dedupeKey, orderNo, orderDate, buyerName, buyerPhone, recvName, recvPhone, product, opt, qty, amount, kind, status, note)
    VALUES (${p.source}, ${p.dedupeKey}, ${p.orderNo ?? null}, ${p.orderDate ?? null}, ${p.buyerName ?? null}, ${normPhone(p.buyerPhone) || null},
      ${p.recvName ?? null}, ${normPhone(p.recvPhone) || null}, ${p.product ?? null}, ${p.opt ?? null}, ${p.qty ?? 1}, ${p.amount ?? null},
      ${p.kind ?? "구매"}, ${p.status ?? null}, ${(p.note ?? "").slice(0, 120) || null})`);
  return true;
}

/**
 * 엑셀 정리 파일(탭으로 나뉜 글)을 올린다.
 * 칸: 날짜, 주문번호, 구매자, 구매자전화, 받는분, 받는분전화, 상품, 옵션, 수량, 시트, 메모, 구분
 * 같은 파일을 두 번 올려도 겹치지 않는다.
 */
export async function importExcel(text: string) {
  let added = 0, same = 0, skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.startsWith("날짜\t")) continue;
    const c = raw.split("\t");
    if (c.length < 9) { skipped++; continue; }
    const [orderDate, orderNo, buyerName, buyerPhone, recvName, recvPhone, product, opt, qty, sheet, note, kind] = c.map(s => (s ?? "").trim());
    if (!normPhone(buyerPhone) && !normPhone(recvPhone)) { skipped++; continue; }
    const dedupeKey = orderNo ? `n:${orderNo}` : `x:${[orderDate, normPhone(buyerPhone) || normPhone(recvPhone), opt, qty, kind].join("|")}`.slice(0, 191);
    const ok = await upsertPurchase({ source: "excel", dedupeKey, orderNo: orderNo || null, orderDate: orderDate || null, buyerName, buyerPhone, recvName, recvPhone,
      product, opt, qty: Number(qty) || 1, kind: kind || "구매", note: [note, sheet ? `시트 ${sheet}` : ""].filter(Boolean).join(" · ") });
    ok ? added++ : same++;
  }
  return { added, same, skipped };
}

/** 가입한 사람의 전화번호들: 가입 때 적은 번호 + 명단 번호 */
async function phonesByUser(): Promise<Map<number, string[]>> {
  const users = await q(sql`SELECT id, phone FROM users`);
  const roster = await q(sql`SELECT usedByUserId, phone FROM roster WHERE usedByUserId IS NOT NULL`);
  const m = new Map<number, Set<string>>();
  const add = (id: number, p: string) => { const d = normPhone(p); if (d.length >= 10) { if (!m.has(id)) m.set(id, new Set()); m.get(id)!.add(d); } };
  users.forEach(u => add(Number(u.id), u.phone));
  roster.forEach(r => add(Number(r.usedByUserId), r.phone));
  return new Map(Array.from(m.entries()).map(([k, v]) => [k, Array.from(v)]));
}

type Sum = { count: number; boxes: number; amount: number; first: string | null; last: string | null };
function summarize(rows: any[]): Sum {
  const buys = rows.filter(r => r.kind === "구매");
  const dates = buys.map(r => r.orderDate).filter(Boolean).sort();
  return {
    count: buys.length,
    boxes: buys.reduce((a, r) => a + (Number(r.qty) || 1), 0),
    amount: buys.reduce((a, r) => a + (Number(r.amount) || 0), 0),
    first: dates[0] ?? null, last: dates[dates.length - 1] ?? null,
  };
}

/** 한 크루의 전체 구매 기록 (이름 누르면 보이는 것) */
export async function forUser(userId: number) {
  const phones = (await phonesByUser()).get(userId) ?? [];
  if (!phones.length) return { phones: [], summary: summarize([]), rows: [] as any[] };
  const list = sql.join(phones.map(p => sql`${p}`), sql`, `);
  const rows = await q(sql`SELECT id, source, orderNo, orderDate, buyerName, recvName, product, opt, qty, amount, kind, status, note,
      (buyerPhone IN (${list})) AS asBuyer
    FROM purchases WHERE buyerPhone IN (${list}) OR recvPhone IN (${list}) ORDER BY orderDate DESC, id DESC`);
  return { phones, summary: summarize(rows), rows };
}

/** 멤버 목록에 붙일 요약: userId → 구매 횟수·마지막 구매일 */
export async function summaryByUser() {
  const byUser = await phonesByUser();
  const rows = await q(sql`SELECT buyerPhone, recvPhone, orderDate, qty, amount, kind FROM purchases`);
  const byPhone = new Map<string, any[]>();
  for (const r of rows) for (const p of Array.from(new Set<string>([r.buyerPhone, r.recvPhone].filter(Boolean)))) {
    if (!byPhone.has(p)) byPhone.set(p, []); byPhone.get(p)!.push(r);
  }
  const out: Record<number, Sum> = {};
  for (const [uid, phones] of Array.from(byUser.entries())) {
    const mine = new Set<any>(); phones.forEach(p => (byPhone.get(p) ?? []).forEach(r => mine.add(r)));
    if (mine.size) out[uid] = summarize(Array.from(mine));
  }
  return out;
}

/** 구매왕: 전화번호(구매자) 기준으로 묶어서 많이 산 순서. 앱 가입 여부도 함께 */
export async function ranking(since?: string | null) {
  const rows = since
    ? await q(sql`SELECT buyerName, buyerPhone, recvPhone, orderDate, qty, amount, kind FROM purchases WHERE kind = '구매' AND orderDate >= ${since}`)
    : await q(sql`SELECT buyerName, buyerPhone, recvPhone, orderDate, qty, amount, kind FROM purchases WHERE kind = '구매'`);
  const byUser = await phonesByUser();
  const userOfPhone = new Map<string, number>();
  byUser.forEach((ps, uid) => ps.forEach(p => userOfPhone.set(p, uid)));
  const names = new Map((await q(sql`SELECT id, name FROM users`)).map(u => [Number(u.id), u.name as string]));
  const g = new Map<string, { phone: string; buyerName: string; rows: any[] }>();
  for (const r of rows) {
    const p = r.buyerPhone || r.recvPhone; if (!p) continue;
    if (!g.has(p)) g.set(p, { phone: p, buyerName: r.buyerName ?? "", rows: [] });
    g.get(p)!.rows.push(r);
  }
  return Array.from(g.values()).map(x => {
    const uid = userOfPhone.get(x.phone) ?? null;
    return { phoneTail: x.phone.slice(-4), buyerName: x.buyerName, userId: uid, nickname: uid ? names.get(uid) ?? null : null, ...summarize(x.rows) };
  }).sort((a, b) => b.count - a.count || b.boxes - a.boxes || b.amount - a.amount).slice(0, 2000);
}

/** 우리 방 순위 (2026-11-23): 앱에 가입(수락)한 크루 전원. 안 산 크루도 0번으로 맨 아래에 */
export async function crewRanking(since?: string | null) {
  const byUser = await phonesByUser();
  const users = await q(sql`SELECT id, name FROM users WHERE status = 'approved'`);
  const rows = since
    ? await q(sql`SELECT buyerPhone, recvPhone, orderDate, qty, amount, kind FROM purchases WHERE kind = '구매' AND orderDate >= ${since}`)
    : await q(sql`SELECT buyerPhone, recvPhone, orderDate, qty, amount, kind FROM purchases WHERE kind = '구매'`);
  const byPhone = new Map<string, any[]>();
  for (const r of rows) for (const p of Array.from(new Set<string>([r.buyerPhone, r.recvPhone].filter(Boolean)))) {
    if (!byPhone.has(p)) byPhone.set(p, []); byPhone.get(p)!.push(r);
  }
  return users.map(u => {
    const uid = Number(u.id);
    const phones = byUser.get(uid) ?? [];
    const mine = new Set<any>(); phones.forEach(p => (byPhone.get(p) ?? []).forEach(r => mine.add(r)));
    return { userId: uid, nickname: (u.name as string) ?? null, buyerName: null as string | null, phoneTail: phones[0]?.slice(-4) ?? "", hasPhone: phones.length > 0, ...summarize(Array.from(mine)) };
  }).sort((a, b) => b.count - a.count || b.boxes - a.boxes || (a.nickname ?? "").localeCompare(b.nickname ?? ""));
}

export async function stats() {
  const r = (await q(sql`SELECT COUNT(*) AS n, SUM(source='excel') AS excel, SUM(source='naver') AS naver, MAX(orderDate) AS last FROM purchases`))[0] ?? {};
  return { total: Number(r.n ?? 0), excel: Number(r.excel ?? 0), naver: Number(r.naver ?? 0), last: r.last ?? null };
}
