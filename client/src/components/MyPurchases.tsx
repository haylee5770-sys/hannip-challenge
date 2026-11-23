// 구매하기 화면 맨 아래 '내 구매 기록' (2026-11-23)
// 방장이 관리 › 구매 기록에서 공개하기 전에는 방장에게만 '미리보기'로 보인다. 크루에게는 아무것도 안 보인다.
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function MyPurchases() {
  const q = trpc.crew.myPurchases.useQuery(undefined, { staleTime: 60_000 });
  const [all, setAll] = useState(false);
  const d = q.data;
  if (!d || !d.visible) return null;
  const rows = d.rows;
  const shown = all ? rows : rows.slice(0, 5);
  const buys = rows.filter(r => r.kind === "구매");
  return (
    <section className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">🧾 내 구매 기록</h2>
        {d.preview && <span className="rounded-lg bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-200">비공개 · 방장만 보여요</span>}
      </div>
      {!d.hasPhone ? (
        <p className="text-sm text-muted-foreground">앱에 등록된 전화번호가 없어서 기록을 찾을 수 없어요.</p>
      ) : buys.length === 0 && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 구매 기록이 없어요.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-primary/10 py-3"><div className="text-2xl font-black text-primary">{d.summary.count}</div><div className="text-[11px] text-muted-foreground">구매 횟수</div></div>
            <div className="rounded-2xl bg-primary/10 py-3"><div className="text-2xl font-black text-primary">{d.summary.boxes}</div><div className="text-[11px] text-muted-foreground">수량</div></div>
            <div className="rounded-2xl bg-primary/10 py-3"><div className="text-sm font-black text-primary mt-1.5">{d.summary.first ?? "–"}</div><div className="text-[11px] text-muted-foreground">첫 구매</div></div>
          </div>
          <div className="divide-y divide-border">
            {shown.map(r => (
              <div key={r.id} className="py-2 text-sm flex gap-3">
                <span className="text-muted-foreground tabular-nums shrink-0">{r.orderDate ?? "–"}</span>
                <span className="flex-1 min-w-0 break-keep">
                  {r.kind !== "구매" && <span className="mr-1 rounded bg-secondary px-1 text-[11px]">{r.kind}</span>}
                  {r.opt || r.product}{r.qty > 1 ? ` × ${r.qty}` : ""}
                </span>
              </div>
            ))}
          </div>
          {rows.length > 5 && (
            <button type="button" onClick={() => setAll(v => !v)} className="w-full text-sm text-muted-foreground underline">
              {all ? "접기" : `전체 ${rows.length}건 보기`}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed">주문할 때 적은 전화번호(주문자 또는 받는 분)로 찾은 기록이에요. 빠진 주문이 있으면 의견 보내기로 알려 주세요.</p>
        </>
      )}
    </section>
  );
}
