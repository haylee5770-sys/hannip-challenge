// 바탕화면에 설치하기 (2026-11-22)
// 안드로이드 크롬: 버튼 한 번 → 휴대폰의 '설치할까요?' 창 / 아이폰 사파리: 그림 안내 (애플은 버튼 설치를 막아 둠)
import { useEffect, useState } from "react";

let deferred: any = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; listeners.forEach(f => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach(f => f()); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}
const isStandalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

export default function InstallButton({ onDone }: { onDone?: () => void } = {}) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { const f = () => force(n => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  if (isStandalone()) return null;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const click = async () => {
    if (deferred) { deferred.prompt(); try { const c = await deferred.userChoice; if (c?.outcome === "accepted") onDone?.(); } catch { /* 취소 */ } deferred = null; force(n => n + 1); }
    else setHelp(true);
  };
  return (
    <>
      <button type="button" onClick={click} className="w-full h-12 rounded-2xl border border-primary/60 text-primary font-bold active:scale-[0.98] transition">
        📲 바탕화면에 설치하기
      </button>
      {help && (
        <div className="fixed inset-0 z-[130] bg-black/80 flex items-end justify-center p-5" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 space-y-3 text-left season-fade-in" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold">📲 바탕화면에 추가하기</div>
            {ios ? (
              <ol className="space-y-2 text-sm leading-relaxed">
                <li>① 화면 맨 아래 가운데 <b>공유 버튼</b> <span className="inline-block rounded border px-1">□↑</span> 을 눌러요</li>
                <li>② 아래로 내려서 <b>'홈 화면에 추가'</b>를 눌러요</li>
                <li>③ 오른쪽 위 <b>'추가'</b>를 누르면 끝!</li>
              </ol>
            ) : (
              <ol className="space-y-2 text-sm leading-relaxed">
                <li>① 크롬 오른쪽 위 <b>점 세 개 ⋮</b> 를 눌러요</li>
                <li>② <b>'홈 화면에 추가'</b> 또는 <b>'앱 설치'</b>를 눌러요</li>
                <li>③ <b>'설치'</b>를 누르면 끝!</li>
              </ol>
            )}
            <p className="text-xs text-muted-foreground">다음부터는 바탕화면의 '챌린지 보드' 아이콘으로 바로 들어와요.</p>
            {ios && <div className="text-center text-3xl animate-bounce">⬇️</div>}
            <button type="button" onClick={() => { setHelp(false); onDone?.(); }} className="w-full rounded-2xl glass-btn py-3 font-bold">{ios ? "홈 화면에 추가했어요" : "설치했어요"}</button>
          </div>
        </div>
      )}
    </>
  );
}

export { isStandalone };
