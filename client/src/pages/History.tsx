// 명예의 전당 (2026-11-22, 예전 '역대 챌린지' 자리) — 10kg 이상 감량(누르면 기수별 기록) · 5kg 이상 감량(한 번의 챌린지)
// 지난 수상자는 시상식 아래 '역대 수상자'에 있다.
import { useState } from "react";
import { TEN_KG, FIVE_KG, type Ten } from "@/lib/hallOfFame";

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}kg`;

function Detail({ t, onClose }: { t: Ten; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-primary/50 bg-card p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <h3 className="text-2xl font-black">{t.name}</h3>
          <span className="text-2xl font-black text-primary tabular-nums">−{kg(t.kg)}</span>
        </div>
        <div className="text-xs text-primary">{t.seasons}</div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 divide-y divide-primary/15">
          {t.log.map((l, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-14 shrink-0 font-bold text-primary">{l.no}</span>
              {l.from != null && l.to != null ? (
                <>
                  <span className="flex-1 tabular-nums">{l.from} → {l.to}kg</span>
                  <span className="font-black tabular-nums">−{(l.from - l.to).toFixed(1)}</span>
                </>
              ) : <span className="flex-1 text-muted-foreground text-xs">{l.note}</span>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">총감량은 첫 기수 시작 체중부터 마지막 기수 끝 체중까지예요.</p>
        <button type="button" className="glass-btn w-full h-11" onClick={onClose}><span className="relative z-[1]">닫기</span></button>
      </div>
    </div>
  );
}

export default function History() {
  const [open, setOpen] = useState<Ten | null>(null);
  const empty = TEN_KG.length % 2 === 1 ? 1 : 0; // 짝이 안 맞으면 빈 칸 하나 ("다음은 누구일까요?")
  return (
    <div className="space-y-8">
      <section className="text-center pb-1">
        <div className="editorial-eyebrow text-primary mb-1">HALL OF FAME</div>
        <h1 className="text-3xl md:text-4xl font-semibold">명예의 전당</h1>
        <p className="text-xs text-muted-foreground mt-1">슈퍼한입 챌린지와 함께 몸이 바뀐 크루들</p>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-3xl font-black">🏅 10kg 이상 감량</h2>
          <p className="text-sm font-semibold text-primary mt-1">포기하지 않은 꾸준함이 만든 기적</p>
        </div>
        <div className="h-2" />
        <div className="grid grid-cols-2 gap-2">
          {TEN_KG.map(t => (
            <button type="button" key={t.name} onClick={() => setOpen(t)} className="text-left rounded-2xl border border-primary/40 bg-primary/10 px-3 py-3 active:scale-[0.98] transition">
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-bold text-base">{t.name}</span>
                <span className="text-primary font-black tabular-nums">{kg(t.kg)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.seasons} ›</div>
            </button>
          ))}
          {empty ? (
            <div className="rounded-2xl border-2 border-dashed border-primary/40 px-3 py-3 flex items-center justify-center text-sm text-primary/80 font-semibold">다음은 누구일까요?</div>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground px-1">이름을 누르면 기수별 기록이 나와요.</p>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-3xl font-black">✨ 5kg 이상 감량</h2>
          <p className="text-sm font-semibold text-primary mt-1">오직 한 번의 챌린지에서 5kg 이상 감량한 크루</p>
        </div>
        <div className="h-2" />
        <div className="rounded-2xl border border-primary/30 bg-primary/5 divide-y divide-primary/15">
          {[...FIVE_KG].sort((a, b) => parseFloat(a.no) - parseFloat(b.no)).map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-12 shrink-0 text-primary font-bold">{f.no}</span>
              <span className="flex-1 font-semibold">{f.name}</span>
              {f.from != null && f.to != null && <span className="text-[11px] text-muted-foreground tabular-nums">{f.from} → {f.to}</span>}
              <span className="w-14 text-right font-black tabular-nums">{kg(f.kg)}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-[11px] text-muted-foreground pb-4">지난 시즌 수상자는 시상식 아래 '역대 수상자'에서 볼 수 있어요.</p>
      {open && <Detail t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
