// 2026-11-25 (해이 확정): 할인 링크는 상시로 열지 않는다 → 매달 1일·15일, 한국 시간 0시 ~ 밤 11시 59분 딱 하루만 저절로 열리고 닫힌다
export const SALE_DAYS = [1, 15];
const KST = 9 * 3600_000;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** 한국 시간으로 y년 m월(0부터) d일 0시의 실제 시각 */
const kstMidnight = (y: number, m: number, d: number) => Date.UTC(y, m, d) - KST;

export type SaleSlot = { key: string; start: number; end: number; label: string; short: string };

export function saleWindow(now = Date.now()): { live?: SaleSlot; next: SaleSlot } {
  const k = new Date(now + KST); // 한국 날짜를 UTC 칸으로 읽는다
  const y = k.getUTCFullYear(), m = k.getUTCMonth(), d = k.getUTCDate();
  const mk = (yy: number, mm: number, dd: number): SaleSlot => {
    const start = kstMidnight(yy, mm, dd), end = start + 24 * 3600_000 - 1000;
    const t = new Date(start + KST);
    const md = `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일(${DOW[t.getUTCDay()]})`;
    return { key: `${t.getUTCFullYear()}-${t.getUTCMonth() + 1}-${t.getUTCDate()}`, start, end, label: `${md} 0시 ~ 밤 11시 59분`, short: md };
  };
  const live = SALE_DAYS.includes(d) ? mk(y, m, d) : undefined;
  const nextDay = SALE_DAYS.find(x => x > d);
  const next = nextDay ? mk(y, m, nextDay) : mk(y, m + 1, SALE_DAYS[0]);
  return { live, next };
}
