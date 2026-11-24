// 공지 팝업 (2026-11-24 해이): 사진을 한 장씩 넘겨 마지막 장까지 봐야 [다 읽었어요]가 눌린다.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { markNoticeSeen, nextNotice, type Notice } from "@/lib/notices";

export default function NoticePopup() {
  const [n, setN] = useState<Notice | null>(() => nextNotice());
  const [idx, setIdx] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => { setIdx(0); setMaxSeen(0); box.current?.scrollTo({ left: 0 }); }, [n?.id]);
  useEffect(() => {
    if (!n) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [n]);
  if (!n) return null;

  const total = n.images.length;
  const done = maxSeen >= total - 1;
  const go = (i: number) => {
    const el = box.current; if (!el) return;
    const k = Math.max(0, Math.min(total - 1, i));
    el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = box.current; if (!el) return;
    const k = Math.round(el.scrollLeft / el.clientWidth);
    setIdx(k); setMaxSeen(m => Math.max(m, k));
  };
  const close = (toManual?: boolean) => {
    markNoticeSeen(n.id);
    setN(nextNotice());
    if (toManual && n.manualHash) navigate(`/manual#${n.manualHash}`);
  };

  return (
    // 2026-11-24 해이: 바깥 테두리(포인트 색)가 최대 크기 — 그 안은 여백·테두리 없이 사진을 꽉 채운다. 가로는 꽉, 세로는 사진 비율만큼만(위아래로 뒤 화면이 보여야 팝업 느낌)
    <div className="fixed inset-0 z-[115] bg-black/70 flex items-center justify-center p-1.5" style={{ paddingTop: "max(6px, env(safe-area-inset-top))", paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-lg max-h-full flex flex-col rounded-3xl bg-card border-2 border-primary overflow-hidden shadow-2xl">
        <div className="px-3 pt-2 pb-1 flex items-baseline gap-2">
          <div className="text-base font-black text-primary truncate">{n.title}</div>
          <span className="ml-auto shrink-0 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">{idx + 1} / {total}</span>
        </div>
        <div className="relative w-full aspect-[4/5] max-h-[72vh] shrink">
          <div ref={box} onScroll={onScroll} className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
            {n.images.map((src, i) => (
              <img key={src} src={src} alt={`공지 ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} onClick={() => setZoom(src)}
                className="shrink-0 w-full h-full snap-center object-contain allow-save" />
            ))}
          </div>
          {idx > 0 && <button type="button" aria-label="이전" onClick={() => go(idx - 1)} className="absolute left-0.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-2xl">‹</button>}
          {idx < total - 1 && <button type="button" aria-label="다음" onClick={() => go(idx + 1)} className="absolute right-0.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary text-black text-2xl font-black">›</button>}
        </div>
        <div className="px-2 pb-2 pt-1 space-y-1.5">
          <div className="flex justify-center gap-1">
            {n.images.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === idx ? "w-5 bg-primary" : i <= maxSeen ? "w-1.5 bg-primary/60" : "w-1.5 bg-white/25"}`} />)}
          </div>
          <div className="text-center text-[11px] text-muted-foreground">글씨가 작으면 사진을 눌러 크게 보세요 🔍</div>
          {done ? (
            <div className="grid gap-1.5">
              <button type="button" onClick={() => close()} className="min-h-12 py-2 px-3 rounded-2xl glass-btn font-black text-sm leading-snug">✅ 다 읽었어요. 이제 안 헷갈려요!<br /><span className="text-xs font-bold opacity-90">헷갈리면 다시 와서 또 볼게요.<br />의견이 생기면 또 남길게요. 화이팅! 💪</span></button>
              {n.manualHash ? <button type="button" onClick={() => close(true)} className="h-10 rounded-2xl border border-primary/60 text-primary font-bold text-xs">{n.manualLabel ?? "사용설명서에서 보기"}</button> : null}
            </div>
          ) : (
            <button type="button" onClick={() => go(idx + 1)} className="w-full h-11 rounded-2xl bg-primary/20 border border-primary/60 text-primary font-black text-sm">
              옆으로 넘겨 끝까지 봐 주세요 👉 ({idx + 1}/{total})
            </button>
          )}
        </div>
      </div>
      {zoom && (
        <div className="fixed inset-0 z-[116] bg-black flex flex-col" onClick={() => setZoom(null)}>
          <div className="flex-1 overflow-auto" onClick={e => e.stopPropagation()}>
            <img src={zoom} alt="크게 보기" className="max-w-none allow-save" style={{ width: "170%" }} />
          </div>
          <button type="button" onClick={() => setZoom(null)} className="m-2 h-11 rounded-2xl glass-btn font-black text-sm">닫기 (손가락으로 움직여 보세요)</button>
        </div>
      )}
    </div>
  );
}
