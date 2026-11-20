// 앱 안 확인 팝업 (2026-11-21): 휴대폰·카톡 안 브라우저에서는 기본 confirm 창이 안 뜨고 바로 넘어가는 경우가 있어서 직접 띄운다.
export type ConfirmReq = { message: string; ok?: string; resolve: (v: boolean) => void };

export function askConfirm(message: string, ok = "삭제"): Promise<boolean> {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent<ConfirmReq>("hannip-confirm", { detail: { message, ok, resolve } }));
  });
}
