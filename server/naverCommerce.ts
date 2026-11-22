// 네이버 커머스 API로 스마트스토어 주문 자동 수집 (2026-11-22)
// 필요한 환경변수 (Railway Variables에 해이가 직접 넣는다. 코드·채팅에 넣지 않는다):
//   NAVER_COMMERCE_CLIENT_ID, NAVER_COMMERCE_CLIENT_SECRET
//   FIXIE_URL  — 고정 IP 프록시 주소. 네이버에는 이 프록시의 IP만 등록돼 있어서 반드시 이걸 거쳐서 부른다
// 하루 1번(서버 시작 1분 뒤 + 24시간마다) 마지막으로 가져온 때부터 지금까지 바뀐 주문을 가져온다.
import axios, { type AxiosInstance } from "axios";
import bcrypt from "bcryptjs";
import { HttpsProxyAgent } from "https-proxy-agent";
import { upsertPurchase, getState, setState } from "./purchases";

const BASE = "https://api.commerce.naver.com/external";
const DAY = 24 * 60 * 60 * 1000;
const FIRST_FROM = "2026-11-12T00:00:00.000+09:00"; // 엑셀 주문서가 11/13까지라 그 전날부터

export function naverConfigured() {
  return !!(process.env.NAVER_COMMERCE_CLIENT_ID && process.env.NAVER_COMMERCE_CLIENT_SECRET);
}

function client(): AxiosInstance {
  const proxy = process.env.FIXIE_URL || process.env.NAVER_PROXY_URL;
  return axios.create({
    baseURL: BASE, timeout: 20000, proxy: false,
    ...(proxy ? { httpsAgent: new HttpsProxyAgent(proxy) } : {}),
  });
}

async function token(http: AxiosInstance) {
  const id = process.env.NAVER_COMMERCE_CLIENT_ID!, secret = process.env.NAVER_COMMERCE_CLIENT_SECRET!;
  const timestamp = Date.now();
  const sign = Buffer.from(bcrypt.hashSync(`${id}_${timestamp}`, secret), "utf-8").toString("base64");
  const body = new URLSearchParams({ client_id: id, timestamp: String(timestamp), client_secret_sign: sign, grant_type: "client_credentials", type: "SELF" });
  const r = await http.post("/v1/oauth2/token", body.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  return r.data.access_token as string;
}

/** 한국 시간 ISO (네이버가 요구하는 모양: 2026-11-22T10:00:00.000+09:00) */
function kst(ms: number) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().replace("Z", "+09:00");
}

async function changedIds(http: AxiosInstance, auth: string, fromMs: number, toMs: number) {
  const ids = new Set<string>();
  let from = kst(fromMs); let seq: string | undefined; let guard = 0;
  while (guard++ < 30) {
    const params: Record<string, string> = { lastChangedFrom: from, lastChangedTo: kst(toMs) };
    if (seq) params.moreSequence = seq;
    const r = await http.get("/v1/pay-order/seller/product-orders/last-changed-statuses", { params, headers: { Authorization: `Bearer ${auth}` } });
    const d = r.data?.data ?? {};
    for (const s of d.lastChangeStatuses ?? []) if (s?.productOrderId) ids.add(String(s.productOrderId));
    if (!d.more?.moreFrom) break;
    from = d.more.moreFrom; seq = d.more.moreSequence;
  }
  return Array.from(ids);
}

async function details(http: AxiosInstance, auth: string, ids: string[]) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const r = await http.post("/v1/pay-order/seller/product-orders/query", { productOrderIds: ids.slice(i, i + 300) }, { headers: { Authorization: `Bearer ${auth}` } });
    out.push(...(r.data?.data ?? []));
  }
  return out;
}

let running = false;
/** 주문 가져오기. 결과를 사람이 읽을 수 있게 돌려준다 */
export async function syncNaverOrders(): Promise<{ ok: boolean; message: string; added?: number; updated?: number }> {
  if (!naverConfigured()) return { ok: false, message: "네이버 API 키가 아직 Railway에 없어요" };
  if (!process.env.FIXIE_URL && !process.env.NAVER_PROXY_URL) return { ok: false, message: "고정 IP(FIXIE_URL)가 아직 Railway에 없어요" };
  if (running) return { ok: false, message: "이미 가져오는 중이에요" };
  running = true;
  try {
    const http = client();
    const auth = await token(http);
    const last = await getState("naver.lastTo");
    let fromMs = last ? Number(last) : Date.parse(FIRST_FROM);
    const now = Date.now() - 60 * 1000;
    let added = 0, updated = 0;
    while (fromMs < now) {
      const toMs = Math.min(fromMs + DAY - 1000, now);
      const ids = await changedIds(http, auth, fromMs, toMs);
      if (ids.length) {
        for (const it of await details(http, auth, ids)) {
          const o = it.order ?? {}, p = it.productOrder ?? {}, ship = p.shippingAddress ?? {};
          const status = String(p.productOrderStatus ?? "");
          const cancelled = /CANCEL|RETURN/.test(status);
          const isNew = await upsertPurchase({
            source: "naver", dedupeKey: `n:${p.productOrderId}`, orderNo: String(p.productOrderId ?? ""),
            orderDate: String(o.paymentDate ?? o.orderDate ?? "").slice(0, 10) || null,
            buyerName: o.ordererName ?? null, buyerPhone: o.ordererTel ?? null,
            recvName: ship.name ?? null, recvPhone: ship.tel1 ?? null,
            product: p.productName ?? null, opt: p.productOption ?? null, qty: Number(p.quantity) || 1,
            amount: Number(p.totalPaymentAmount) || null, kind: cancelled ? "취소" : "구매", status,
            note: p.shippingMemo ?? null,
          });
          isNew ? added++ : updated++;
        }
      }
      fromMs = toMs + 1;
      await setState("naver.lastTo", String(fromMs));
    }
    const msg = `새 주문 ${added}건, 바뀐 주문 ${updated}건`;
    await setState("naver.lastResult", `${new Date().toISOString()} ${msg}`);
    console.log("[naver] sync ok:", msg);
    return { ok: true, message: msg, added, updated };
  } catch (e: any) {
    const detail = e?.response?.data ? JSON.stringify(e.response.data).slice(0, 300) : (e?.message ?? String(e));
    const msg = `가져오기 실패: ${detail}`;
    await setState("naver.lastResult", `${new Date().toISOString()} ${msg}`).catch(() => {});
    console.warn("[naver] sync failed:", detail);
    return { ok: false, message: msg };
  } finally { running = false; }
}

export async function naverStatus() {
  return {
    configured: naverConfigured(),
    proxy: !!(process.env.FIXIE_URL || process.env.NAVER_PROXY_URL),
    lastResult: await getState("naver.lastResult"),
  };
}

/** 서버가 켜지면 1분 뒤 한 번, 그 뒤 24시간마다 */
export function startNaverSchedule() {
  if (!naverConfigured()) { console.log("[naver] 키 없음 — 자동 수집 꺼짐"); return; }
  setTimeout(() => void syncNaverOrders(), 60 * 1000);
  setInterval(() => void syncNaverOrders(), DAY);
}
