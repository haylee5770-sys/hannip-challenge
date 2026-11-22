// 명예의 전당 (2026-11-22, 예전 '역대 챌린지' 자리) — 10kg 이상 감량자(여러 기수) · 5kg 이상 감량자(한 기수)
// 지난 수상자는 시상식 아래 '역대 수상자'에 있다.
import { TEN_KG, FIVE_KG } from "@/lib/hallOfFame";

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}kg`;

export default function History() {
  return (
    <div className="space-y-6">
      <section className="text-center pb-1">
        <div className="editorial-eyebrow text-primary mb-1">HALL OF FAME</div>
        <h1 className="text-3xl md:text-4xl font-semibold">명예의 전당</h1>
        <p className="text-xs text-muted-foreground mt-1">슈퍼한입 챌린지와 함께 몸이 바뀐 크루들</p>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-lg font-black">🏅 10kg 이상 감량</h2>
          <span className="text-[11px] text-muted-foreground">여러 기수에 걸쳐</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TEN_KG.map(t => (
            <div key={t.name} className="rounded-2xl border border-primary/40 bg-primary/10 px-3 py-3">
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-bold text-base">{t.name}</span>
                <span className="text-primary font-black tabular-nums">{kg(t.kg)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.seasons}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-lg font-black">✨ 5kg 이상 감량</h2>
          <span className="text-[11px] text-muted-foreground">한 기수 챌린지에서</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] divide-y divide-white/10">
          {FIVE_KG.map((f, i) => (
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
    </div>
  );
}
