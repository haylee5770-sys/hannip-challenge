import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Sparkles, Trophy, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

function formatPct(p: number) {
  const sign = p > 0 ? "−" : p < 0 ? "+" : "";
  return `${sign}${Math.abs(p).toFixed(2)}%`;
}

export default function Reveal() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.seasons.reveal.useQuery();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const daysUntil = useMemo(() => {
    if (!data?.season) return null;
    const end = new Date(data.season.endDate + "T00:00:00Z").getTime();
    const now = new Date(today + "T00:00:00Z").getTime();
    return Math.max(0, Math.ceil((end - now) / 86400000));
  }, [data?.season, today]);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!data?.season) {
    return (
      <div className="text-center py-24">
        <div className="editorial-eyebrow text-muted-foreground">REVEAL</div>
        <h1 className="editorial-h1 text-5xl mt-3">아직 결산할 시즌이 없어요</h1>
        <p className="text-muted-foreground mt-4">관리자가 새 13일 시즌을 시작하면 이곳에서 결과가 공개됩니다.</p>
      </div>
    );
  }

  if (data.locked) {
    return (
      <div className="space-y-12">
        <section className="grid md:grid-cols-12 gap-8 items-end border-b hairline pb-10">
          <div className="md:col-span-8 space-y-3">
            <div className="editorial-eyebrow text-muted-foreground">REVEAL · 결산 페이지</div>
            <h1 className="editorial-h1 text-5xl md:text-6xl tracking-tight leading-[1.05]">
              마지막 날, <span className="italic font-serif font-light">한꺼번에</span> 공개됩니다.
            </h1>
          </div>
          <div className="md:col-span-4 md:text-right">
            <div className="editorial-eyebrow text-muted-foreground">CURRENT SEASON</div>
            <div className="font-serif text-2xl md:text-3xl">{data.season.name}</div>
            <div className="text-sm text-muted-foreground">
              {data.season.startDate} → {data.season.endDate}
            </div>
          </div>
        </section>

        <Card className="rounded-none border-dashed p-10 md:p-16 text-center bg-secondary/30">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <div className="font-serif text-4xl md:text-5xl mt-6">D − {daysUntil}</div>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            인증 카운트와 최종 랭킹은 시즌 마지막 날에 한 번에 공개돼요. 그날까지는 본인 진행만 보입니다.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>지금까지의 인증은 어디로도 사라지지 않아요. 매일 한 번씩 인증해 주세요.</span>
          </div>
        </Card>
      </div>
    );
  }

  const byLoss = data.byLoss ?? [];
  const byTotal = data.byTotal ?? [];

  return (
    <div className="space-y-14">
      <section className="grid md:grid-cols-12 gap-8 items-end border-b hairline pb-10">
        <div className="md:col-span-8 space-y-3">
          <div className="editorial-eyebrow text-muted-foreground">REVEAL · 시즌 결산</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl tracking-tight leading-[1.02]">
            우리 모두의 <span className="italic font-serif font-light">13일</span>.
          </h1>
        </div>
        <div className="md:col-span-4 md:text-right">
          <div className="editorial-eyebrow text-muted-foreground">SEASON</div>
          <div className="font-serif text-2xl md:text-3xl">{data.season.name}</div>
          <div className="text-sm text-muted-foreground">
            {data.season.startDate} → {data.season.endDate}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{data.entries.length}명 참가</div>
        </div>
      </section>

      {/* Loss % winners */}
      <section className="space-y-6">
        <div className="flex items-baseline gap-3">
          <Award className="h-5 w-5 text-amber-600" />
          <div>
            <div className="editorial-eyebrow text-muted-foreground">CATEGORY · 감량 % 1등</div>
            <h2 className="editorial-h2 text-3xl md:text-4xl">감량률 챔피언</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {byLoss.slice(0, 3).map((e, i) => (
            <PodiumCard key={e.userId} rank={i + 1} title={e.name} highlight={user?.id === e.userId}
              big={formatPct(e.lossPercent)}
              detail={e.lossKg !== null ? `${e.lossKg > 0 ? "−" : "+"}${Math.abs(e.lossKg).toFixed(2)}kg` : "기록 없음"}
            />
          ))}
        </div>
      </section>

      {/* Certifications winners */}
      <section className="space-y-6">
        <div className="flex items-baseline gap-3">
          <Trophy className="h-5 w-5 text-amber-600" />
          <div>
            <div className="editorial-eyebrow text-muted-foreground">CATEGORY · 인증 합산 1등</div>
            <h2 className="editorial-h2 text-3xl md:text-4xl">꾸준함 챔피언</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {byTotal.slice(0, 3).map((e, i) => (
            <PodiumCard key={e.userId} rank={i + 1} title={e.name} highlight={user?.id === e.userId}
              big={`${e.counts.total}`}
              detail={`기상 ${e.counts.weight} · 식단 ${e.counts.meal} · 운동 ${e.counts.exercise}`}
            />
          ))}
        </div>
      </section>

      {/* Public community reports (reflections) */}
      <CommunityReports currentUserId={user?.id} />

      {/* Full table */}
      <section className="space-y-4">
        <div className="editorial-eyebrow text-muted-foreground">FULL TABLE · 전체 결과</div>
        <div className="overflow-x-auto border-y hairline">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground border-b hairline">
                <th className="py-3 px-3 font-normal editorial-eyebrow">#</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow">멤버</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow text-right">감량 %</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow text-right">감량 kg</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow text-right">기상</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow text-right">식단</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow text-right">운동</th>
                <th className="py-3 px-3 font-normal editorial-eyebrow text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {byLoss.map((e, i) => (
                <tr key={e.userId} className={cn("border-b hairline", user?.id === e.userId && "bg-secondary/40")}>
                  <td className="py-3 px-3">{i + 1}</td>
                  <td className="py-3 px-3 font-serif text-base">{e.name}{user?.id === e.userId && <span className="ml-1 text-xs text-muted-foreground">(나)</span>}</td>
                  <td className="py-3 px-3 text-right font-serif">{formatPct(e.lossPercent)}</td>
                  <td className="py-3 px-3 text-right">{e.lossKg !== null ? `${e.lossKg > 0 ? "−" : "+"}${Math.abs(e.lossKg).toFixed(2)}` : "—"}</td>
                  <td className="py-3 px-3 text-right">{e.counts.weight}</td>
                  <td className="py-3 px-3 text-right">{e.counts.meal}</td>
                  <td className="py-3 px-3 text-right">{e.counts.exercise}</td>
                  <td className="py-3 px-3 text-right font-serif text-base">{e.counts.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CommunityReports({ currentUserId }: { currentUserId?: number }) {
  const { data, isLoading } = trpc.seasons.publicReports.useQuery();
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.season || data.locked || data.entries.length === 0) return null;
  return (
    <section className="space-y-6">
      <div className="flex items-baseline gap-3">
        <Sparkles className="h-5 w-5 text-amber-600" />
        <div>
          <div className="editorial-eyebrow text-muted-foreground">REFLECTIONS · 멤버 소감</div>
          <h2 className="editorial-h2 text-3xl md:text-4xl">서로의 기록</h2>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {data.entries.map((e) => {
          const baseline = e.baselineWeightKg;
          const finalW = e.finalWeightKg;
          const lossKg = baseline !== null && finalW !== null ? baseline - finalW : null;
          const isMe = currentUserId === e.userId;
          return (
            <Card
              key={e.userId}
              className={cn(
                "rounded-none border hairline p-5 space-y-3",
                isMe && "ring-2 ring-amber-400",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-serif text-xl">
                  {e.name}
                  {isMe && <span className="ml-1 text-xs text-muted-foreground">(나)</span>}
                </div>
                <div className="text-right">
                  <div className="editorial-eyebrow text-muted-foreground text-[10px]">LOSS</div>
                  <div className="font-serif text-2xl tabular-nums">{formatPct(e.lossPercent)}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {baseline !== null && finalW !== null
                  ? `${baseline.toFixed(1)} → ${finalW.toFixed(1)} kg${lossKg !== null ? ` (${lossKg > 0 ? "−" : "+"}${Math.abs(lossKg).toFixed(2)}kg)` : ""}`
                  : "체중 기록 부족"}
                {" · "}
                기상 {e.weightCount} · 식단 {e.mealCount} · 운동 {e.exerciseCount} · 합계 {e.totalCount}
                {e.completed && <span className="ml-1 text-emerald-700">· 풀 출석</span>}
              </div>
              {e.reflection ? (
                <p className="font-serif italic text-base text-foreground/90 whitespace-pre-wrap leading-relaxed border-l-2 border-foreground/30 pl-3">
                  “{e.reflection}”
                </p>
              ) : (
                <p className="font-serif italic text-sm text-muted-foreground">소감이 아직 없어요.</p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function PodiumCard({ rank, title, big, detail, highlight }: {
  rank: number; title: string; big: string; detail: string; highlight?: boolean;
}) {
  const palette = rank === 1
    ? "bg-foreground text-background"
    : rank === 2
      ? "bg-secondary"
      : "bg-card";
  return (
    <div className={cn("border hairline p-6", palette, highlight && "ring-2 ring-amber-400")}>
      <div className={cn("editorial-eyebrow", rank === 1 ? "text-background/70" : "text-muted-foreground")}>#{rank}</div>
      <div className="font-serif text-2xl mt-1">{title}</div>
      <div className="font-serif text-5xl mt-3 tabular-nums">{big}</div>
      <div className={cn("text-sm mt-2", rank === 1 ? "text-background/80" : "text-muted-foreground")}>{detail}</div>
    </div>
  );
}
