import PageTitle from "@/components/PageTitle";
// 꾸미기 — 색 10가지 · 글씨체 10가지 · 배경 무늬 (2026-11-20)
import { useState } from "react";
import { cn } from "@/lib/utils";
import { COLORS, BACKGROUNDS, FONTS, PATTERNS, DEFAULT_DECOR, loadDecor, saveDecor, type Decor as DecorT } from "@/lib/decor";

export default function Decor() {
  const [d, setD] = useState<DecorT>(() => loadDecor());
  const set = (patch: Partial<DecorT>) => { const n = { ...d, ...patch }; setD(n); saveDecor(n); };

  return (
    <div>
      <div className="pb-6"><PageTitle eyebrow="STYLE" title="내 앱 꾸미기" sub="고르는 즉시 바뀌고, 이 휴대폰에만 저장돼요." /></div>

      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <h2 className="text-lg font-semibold mb-1">포인트 색</h2>
        <p className="text-xs text-muted-foreground mb-3">체크·버튼·강조 글씨 색이에요. 테두리에도 아주 연하게 비쳐요.</p>
        <div className="grid grid-cols-5 gap-3">
          {COLORS.map(c => (
            <button key={c.id} type="button" onClick={() => set({ color: c.id })} className="flex flex-col items-center gap-1">
              <span
                className={cn("w-10 h-10 rounded-full border-2 transition-transform", d.color === c.id ? "border-foreground scale-110" : "border-transparent")}
                style={{ background: c.hex }}
              />
              <span className={cn("text-[11px]", d.color === c.id ? "text-foreground" : "text-muted-foreground")}>{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <h2 className="text-lg font-semibold mb-1">배경 색</h2>
        <p className="text-xs text-muted-foreground mb-3">칸 바깥 바탕색이에요. 칸은 자동으로 조금 더 밝게 맞춰져요.</p>
        <div className="grid grid-cols-5 gap-3">
          {BACKGROUNDS.map(b => (
            <button key={b.id} type="button" onClick={() => set({ bg: b.id })} className="flex flex-col items-center gap-1">
              <span
                className={cn("w-10 h-10 rounded-full border-2 transition-transform", d.bg === b.id ? "border-primary scale-110" : "border-white/20")}
                style={{ background: b.hex }}
              />
              <span className={cn("text-[11px]", d.bg === b.id ? "text-foreground" : "text-muted-foreground")}>{b.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <h2 className="text-lg font-semibold mb-3">글씨체</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {FONTS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ font: f.id })}
              data-keep-font=""
              className={cn("rounded-xl border px-3 py-3 text-base transition-colors", d.font === f.id ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")}
              style={{ fontFamily: `${f.family || "'Pretendard', 'Noto Sans KR'"}, sans-serif` }}
            >
              {f.name}
              <div className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: `${f.family || "'Pretendard', 'Noto Sans KR'"}, sans-serif` }}>나를 칭찬해요</div>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <h2 className="text-lg font-semibold mb-1">배경 무늬</h2>
        <p className="text-xs text-muted-foreground mb-3">칸 바깥 바탕에 깔려요.</p>
        <div className="grid grid-cols-5 gap-2">
          {PATTERNS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => set({ pattern: p.id })}
              className={cn("rounded-xl border h-16 text-xs flex items-end justify-center pb-1.5 transition-colors", d.pattern === p.id ? "border-primary" : "border-border")}
              style={{ background: p.css !== "none" ? `${p.css}, var(--background)` : "var(--background)" }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <h2 className="text-lg font-semibold mb-1">날짜 아래 한 줄</h2>
        <p className="text-xs text-muted-foreground mb-3">켠 것만 오늘 날짜 아래에 작게 보여요. 둘 다 켜도 되고 하나만 켜도 돼요.</p>
        <label className="flex items-start gap-3 py-2 border-b border-border">
          <input type="checkbox" className="mt-1 w-5 h-5 accent-[var(--primary)]" checked={d.quote !== false} onChange={e => set({ quote: e.target.checked })} />
          <span className="flex-1">
            <span className="font-semibold">📜 오늘의 명언</span>
            <span className="block text-xs text-muted-foreground mt-0.5">행복·건강·가족·아이·교육·부부에 대한 유명한 명언을 누가 했는지와 함께 하루 하나씩 보여 줘요.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 py-2">
          <input type="checkbox" className="mt-1 w-5 h-5 accent-[var(--primary)]" checked={!!d.coach} onChange={e => set({ coach: e.target.checked })} />
          <span className="flex-1">
            <span className="font-semibold">🌱 어제 돌아보기 한마디</span>
            <span className="block text-xs text-muted-foreground mt-0.5">어제 기록(수면·식단·물·운동·마음)을 보고 오늘 챙기면 좋을 것을 AI가 한 줄로 알려 줘요.</span>
          </span>
        </label>
      </section>
      <div className="text-right">
        <button type="button" onClick={() => { setD(DEFAULT_DECOR); saveDecor(DEFAULT_DECOR); }} className="text-sm text-muted-foreground underline">
          처음 모습으로 되돌리기
        </button>
      </div>
    </div>
  );
}
