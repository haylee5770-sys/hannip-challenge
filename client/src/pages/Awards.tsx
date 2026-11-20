// 시상식 (2026-11-20) — 진행 중이면 실시간 순위, 방장이 [챌린지 종료]를 누르면 최종 수상자 발표
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type W = { userId: number; name: string; count: number };

export function Podium({ title, sub, list, unit }: { title: string; sub: string; list: W[]; unit: string }) {
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="text-primary text-xs font-semibold">{sub}</div>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">아직 기록이 없어요.</p> : (
        <div className="space-y-2">
          {list.map((w, i) => (
            <div key={w.userId + "-" + i} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", i === 0 ? "bg-primary/15 border border-primary" : "bg-background/40")}>
              <span className="text-2xl w-8 text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
              <span className="font-semibold flex-1">{w.name}</span>
              <span className="tabular-nums text-primary font-bold">{w.count}{unit}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Awards() {
  const q = trpc.rounds.ceremony.useQuery();
  if (q.isLoading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const d = q.data;
  if (!d || d.status === "none") return (
    <div className="text-center py-20"><div className="text-4xl mb-3">🏆</div><h1 className="text-2xl font-semibold">아직 시상식이 없어요</h1>
      <p className="text-sm text-muted-foreground mt-2">방장이 챌린지를 시작하면 이곳에 순위가 보여요.</p></div>
  );
  return (
    <div className="space-y-4">
      <section className="text-center pb-2">
        <div className="editorial-eyebrow text-primary mb-1">{d.status === "live" ? "LIVE · 진행 중" : "AWARDS · 최종 발표"}</div>
        {/* 회차 이름이 길어져도 '시상식'이 어색하게 잘리지 않게: 회차 이름 한 줄 + 시상식 한 줄 (2026-11-21) */}
        <div className="text-lg md:text-xl font-semibold text-foreground/85 break-keep">{d.season?.name}</div>
        <h1 className="text-3xl md:text-4xl font-semibold">🏆 시상식</h1>
        <p className="text-sm text-muted-foreground mt-1">{d.season?.startDate}{d.season?.endDate ? ` ~ ${d.season.endDate}` : " ~ 진행 중"}</p>
      </section>
      <Podium title="이게돼 챔피언" sub="이게돼를 가장 많이 쓴 크루" list={d.byItge as W[]} unit="개" />
      <Podium title="꾸준함 챔피언" sub="인증을 가장 많이 한 크루" list={d.byTotal as W[]} unit="회" />
      {d.status === "live" && <p className="text-center text-xs text-muted-foreground">방장이 [챌린지 종료]를 누르면 최종 수상자가 확정돼요.</p>}
    </div>
  );
}
