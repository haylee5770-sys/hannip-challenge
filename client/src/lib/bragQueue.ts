// 자랑 대기 (2026-11-24 해이): 인증은 먼저 저장하고, 자랑하기는 따로 누른다.
// 자랑하기를 깜빡해도 '⏳ 자랑 전'으로 남아 있어서 나중에 다시 누를 수 있다. (이 폰에만 저장)
import type { ProofCard } from "./proofCard";

export type PendingBrag = { key: string; card: ProofCard; at: number };
const KEY = "hannip_pending_brag";
const MAX = 6;

export function listPending(): PendingBrag[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]") as PendingBrag[];
    const cut = Date.now() - 3 * 24 * 3600_000; // 3일 지난 건 버림
    return arr.filter(p => p && p.card && p.at > cut);
  } catch { return []; }
}

function save(arr: PendingBrag[]) {
  let a = arr.slice(-MAX);
  // 사진이 커서 저장 공간이 모자라면 오래된 것부터 버린다
  while (a.length) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); break; } catch { a = a.slice(1); }
  }
  if (!a.length) try { localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event("hannip-pending-change"));
}

export function addPending(card: ProofCard): string {
  const key = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  save([...listPending(), { key, card, at: Date.now() }]);
  return key;
}

export function removePending(key: string) {
  save(listPending().filter(p => p.key !== key));
}

/** 자랑 창 띄우기: 저장이 시작된 직후 부른다 */
export function openBrag(card: ProofCard, key?: string) {
  const k = key ?? addPending(card);
  window.dispatchEvent(new CustomEvent("hannip-brag-open", { detail: { card, key: k } }));
}
