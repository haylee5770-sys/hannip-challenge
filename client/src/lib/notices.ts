// 공지 팝업 (2026-11-24 해이): 새 업데이트·공지는 앱을 열면 팝업으로 뜨고, 사진을 끝까지 넘겨 봐야 닫을 수 있다.
// 새 공지를 올릴 때: 맨 앞에 하나 추가 (id는 새 값으로). 사진은 client/public/notice/<폴더>/ 에 넣는다.
// 같은 내용은 사용설명서 맨 위 'NEW 업데이트'에도 넣는다 (client/public/guide/index.html).
export type Notice = {
  id: string;          // 바뀌면 다시 뜬다
  title: string;
  sub?: string;
  images: string[];    // 순서대로 넘겨 보는 사진
  manualHash?: string; // '영상도 보기' → 사용설명서 안 그 페이지 (#v17_brag 등)
  manualLabel?: string;
};

// 00.jpg(인증 멈추고 새로고침)는 빼고 01~12만 — 팝업이 떴다면 이미 새로고침된 것 (2026-11-24 해이)
const n1124 = Array.from({ length: 14 }, (_, i) => `/notice/1124/${String(i + 1).padStart(2, "0")}.jpg?v=4`); // 사진을 바꾸면 v 숫자를 올린다(옛 사진이 남지 않게)

export const NOTICES: Notice[] = [
  {
    id: "2026-11-24-update",
    title: "🆕 11월 24일 앱 업데이트",
    sub: "크루님 의견으로 앱이 바뀌었어요. 끝까지 넘겨 봐 주세요!",
    images: n1124,
    manualHash: "v17_brag",
    manualLabel: "🎬 새 자랑하기 영상도 보기",
  },
];

const KEY = "hannip_notice_seen";
export function seenNotices(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function markNoticeSeen(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(new Set([...seenNotices(), id])))); } catch {}
}
/** 아직 안 본 공지 중 가장 최신 */
export function nextNotice(): Notice | null {
  const seen = seenNotices();
  return NOTICES.find(n => !seen.includes(n.id)) ?? null;
}
