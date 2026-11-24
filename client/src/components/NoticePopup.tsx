// 공지 팝업 (2026-11-24 해이): 사진을 한 장씩 넘겨 마지막 장까지 봐야 [다 읽었어요]가 눌린다.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { markNoticeSeen, nextNotice, type Notice } from "@/lib/notices";

export default function NoticePopup() {
  const [n, setN] = useState<Notice | null>(() => nextNotice());
  const [idx, setIdx] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);
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
    <div className="fixed inset-0 z-[115] bg-black/85 flex items-center justify-center p-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="w-full max-w-md max-h-full flex flex-col gap-2 rounded-3xl bg-card border-2 border-primary p-3">
        <div className="px-1">
          <div className="text-lg font-black text-primary">{n.title}</div>
          {n.sub && <div className="text-xs text-muted-foreground">{n.sub}</div>}
        </div>
        <div className="relative">
          <div ref={box} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl" style={{ scrollbarWidth: "none" }}>
            {n.images.map((src, i) => (
              <img key={src} src={src} alt={`공지 ${i + 1}`} loading={i < 2 ? "eager" : "lazy"}
                className="shrink-0 w-full snap-center object-contain max-h-[62vh] bg-black allow-save" />
            ))}
          </div>
          <span className="absolute top-2 right-2 rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-bold text-white">{idx + 1} / {total}</span>
          {idx > 0 && <button type="button" aria-label="이전" onClick={() => go(idx - 1)} className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white text-2xl">‹</button>}
          {idx < total - 1 && <button type="button" aria-label="다음" onClick={() => go(idx + 1)} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary text-black text-2xl font-black">›</button>}
        </div>
        <div className="flex justify-center gap-1 py-1">
          {n.images.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === idx ? "w-5 bg-primary" : i <= maxSeen ? "w-1.5 bg-primary/60" : "w-1.5 bg-white/25"}`} />)}
        </div>
        {done ? (
          <div className="grid gap-2">
            <button type="button" onClick={() => close()} className="w-full h-12 rounded-2xl glass-btn font-black text-base">✅ 다 읽었어요</button>
            {n.manualHash && <button type="button" onClick={() => close(true)} className="w-full h-11 rounded-2xl border border-primary/60 text-primary font-bold text-sm">{n.manualLabel ?? "사용설명서에서 자세히 보기"}</button>}
          </div>
        ) : (
          <button type="button" onClick={() => go(idx + 1)} className="w-full h-12 rounded-2xl bg-primary/20 border border-primary/60 text-primary font-black">
            옆으로 넘겨 끝까지 봐 주세요 👉 ({idx + 1}/{total})
          </button>
        )}
      </div>
    </div>
  );
}
