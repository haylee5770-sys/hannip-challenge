import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, Trophy, Flame, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatPct(p: number) {
  const sign = p > 0 ? "−" : p < 0 ? "+" : "";
  return `${sign}${Math.abs(p).toFixed(2)}%`;
}

export default function Ranking() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: progress, isLoading: loadingProgress } = trpc.seasons.myProgress.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: board, isLoading: loadingBoard } = trpc.seasons.leaderboard.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: isAdmin,
  });
  const { data: liveCounts } = trpc.seasons.adminLiveCounts.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: isAdmin,
  });

  const myRank = (() => {
    if (!board?.entries || !user) return null;
    const idx = board.entries.findIndex(e => e.userId === user.id);
    return idx >= 0 ? idx + 1 : null;
  })();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid md:grid-cols-12 gap-8 items-end border-b hairline pb-10">
        <div className="md:col-span-8 space-y-3">
          <div className="editorial-eyebrow text-muted-foreground">RANKING · 실시간 크루 랭킹</div>
          <h1 className="editorial-h1 text-5xl md:text-6xl tracking-tight leading-[1.05]">
            감량 <span className="italic font-serif font-light">퍼센트</span>로
            <br />다투는 13일.
          </h1>
        </div>
        <div className="md:col-span-4 space-y-2 md:text-right">
          {progress ? (
            <>
              <div className="editorial-eyebrow text-muted-foreground">CURRENT SEASON</div>
              <div className="font-serif text-2xl md:text-3xl">{progress.season.name}</div>
              <div className="text-sm text-muted-foreground">
                {progress.season.startDate} → {progress.season.endDate}
              </div>
              <div className="text-sm text-foreground/80">
                Day <span className="font-serif text-2xl mx-1">{progress.dayNumber ?? "-"}</span>
                <span className="text-muted-foreground">/ {progress.totalDays}</span>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">진행 중인 시즌이 없습니다.</div>
          )}
        </div>
      </section>

      {/* My progress */}
      {loadingProgress ? (
        <Skeleton className="h-32 w-full" />
      ) : progress ? (
        <section className="grid md:grid-cols-3 gap-6">
          <StatCard
            eyebrow="MY LOSS"
            value={formatPct(progress.lossPercent)}
            note={progress.lossKg !== null ? `${progress.lossKg > 0 ? "−" : "+"}${Math.abs(progress.lossKg).toFixed(2)}kg` : "기록 없음"}
            highlight
          />
          <StatCard
            eyebrow="MY RANK"
            value={isAdmin ? (myRank ? `#${myRank}` : "—") : "마지막 날 공개"}
            note={isAdmin ? (board?.entries.length ? `총 ${board.entries.length}명 중` : "참가자 없음") : "경쟁은 계속됩니다"}
          />
          <StatCard
            eyebrow="MY CERTIFICATIONS"
            value={`${progress.counts.total}`}
            note={`체중 ${progress.counts.weight} · 식단 ${progress.counts.meal} · 물 ${(progress.counts as { water?: number }).water ?? 0} · 운동 ${progress.counts.exercise} · 수면 ${progress.counts.sleep ?? 0}`}
          />
        </section>
      ) : null}

      {/* Leaderboard — 일반 멤버는 잠금, 관리자만 전체 공개 */}
      {!isAdmin ? (
        <section className="rounded-none border hairline p-8 md:p-10 bg-secondary/40 text-center space-y-3">
          <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
          <div className="editorial-eyebrow text-muted-foreground">LOCKED</div>
          <h2 className="editorial-h2 text-2xl md:text-3xl">1등과 인증 카운트는
            <br />시즌 마지막 날에 공개됩니다.</h2>
          <p className="font-serif text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            지금은 엄격아지만 단수를 세고 계세요.
            끝난 뒤 아카이브에서 모든 랭킹이 한꺼번에 펼쳐집니다.
          </p>
        </section>
      ) : (
      <section className="space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="editorial-eyebrow text-muted-foreground">LEADERBOARD · ADMIN ONLY</div>
            <h2 className="editorial-h2 text-3xl md:text-4xl">감량 % 순위</h2>
          </div>
          <div className="text-xs text-muted-foreground hidden md:block">30초마다 자동 갱신</div>
        </div>

        {loadingBoard ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !board?.entries.length ? (
          <Card className="rounded-none border-dashed p-10 text-center text-muted-foreground">
            아직 기록을 시작한 멤버가 없어요.
          </Card>
        ) : (
          <ol className="divide-y hairline border-y hairline">
            {board.entries.map((e, i) => {
              const isMe = user?.id === e.userId;
              const rank = i + 1;
              return (
                <li
                  key={e.userId}
                  className={cn(
                    "py-5 grid grid-cols-12 items-center gap-4 transition-colors",
                    isMe && "bg-secondary/40",
                  )}
                >
                  <div className="col-span-1 md:col-span-1 flex items-center gap-2">
                    {rank === 1 ? (
                      <Trophy className="h-5 w-5 text-amber-500" />
                    ) : rank === 2 ? (
                      <Trophy className="h-5 w-5 text-zinc-400" />
                    ) : rank === 3 ? (
                      <Trophy className="h-5 w-5 text-amber-700" />
                    ) : (
                      <span className="editorial-eyebrow text-muted-foreground">#{rank}</span>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-5">
                    <div className="flex items-center gap-3">
                      {e.avatarUrl ? (
                        <img src={e.avatarUrl} alt={e.name} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-serif">
                          {e.name?.[0] ?? "M"}
                        </div>
                      )}
                      <div>
                        <div className="font-serif text-lg">{e.name}{isMe && <span className="ml-2 text-xs text-muted-foreground">(나)</span>}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.baselineWeightKg ? `시작 ${e.baselineWeightKg.toFixed(1)}kg` : "시작 기록 없음"}
                          {e.currentWeightKg ? ` → 현재 ${e.currentWeightKg.toFixed(1)}kg` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-3 text-right">
                    <div className="text-xs text-muted-foreground editorial-eyebrow">LOSS</div>
                    <div className={cn(
                      "font-serif text-2xl tabular-nums",
                      e.lossPercent > 0 ? "text-emerald-700" : e.lossPercent < 0 ? "text-rose-700" : "text-foreground",
                    )}>
                      {formatPct(e.lossPercent)}
                    </div>
                  </div>
                  <div className="col-span-3 md:col-span-3 text-right text-sm text-muted-foreground tabular-nums">
                    {e.lossKg !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {e.lossKg > 0 ? "−" : "+"}{Math.abs(e.lossKg).toFixed(2)}kg
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      )}

      {isAdmin && liveCounts?.entries && liveCounts.entries.length > 0 && (
        <section className="space-y-4">
          <div className="editorial-eyebrow text-muted-foreground">CERTIFICATION COUNTS · ADMIN ONLY</div>
          <h2 className="editorial-h2 text-2xl md:text-3xl">인증 카운트 랭킹 (1등 결정 기준)</h2>
          <div className="border-y hairline divide-y hairline">
            {liveCounts.entries.slice(0, 20).map((e, i) => (
              <div key={e.userId} className="py-4 grid grid-cols-12 items-center gap-3">
                <div className="col-span-1 editorial-eyebrow text-muted-foreground">#{i + 1}</div>
                <div className="col-span-5 font-serif text-lg">{e.name}</div>
                <div className="col-span-4 text-xs text-muted-foreground">체중 {e.weightCount} · 식단 {e.mealCount} · 물 {(e as { waterCount?: number }).waterCount ?? 0} · 운동 {e.exerciseCount} · 수면 {e.sleepCount}</div>
                <div className="col-span-2 text-right font-serif text-2xl tabular-nums">{e.totalCount}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-none border hairline p-6 md:p-8 bg-secondary/30">
        <div className="flex items-start gap-3">
          <Flame className="h-5 w-5 text-amber-600 mt-1" />
          <div>
            <div className="editorial-eyebrow text-muted-foreground">HOW IT WORKS</div>
            <p className="font-serif text-base md:text-lg leading-relaxed mt-2">
              1등은 <strong>인증 카운트 합계(체중 · 식단 · 물 · 운동 · 수면)</strong>가 가장 많은 멤버가 차지합니다. 진행 중에는 순위를 공개하지 않고, 시즌이 끝나면 아카이브에 영구 보관되어 전체에게 공개됩니다. 감량 % 메달은 별도로 적립됩니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ eyebrow, value, note, highlight }: { eyebrow: string; value: string; note: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "border hairline p-6 md:p-7",
      highlight ? "bg-foreground text-background" : "bg-card",
    )}>
      <div className={cn(
        "editorial-eyebrow",
        highlight ? "text-background/70" : "text-muted-foreground",
      )}>{eyebrow}</div>
      <div className="font-serif text-4xl md:text-5xl mt-2 tabular-nums">{value}</div>
      <div className={cn(
        "text-sm mt-2",
        highlight ? "text-background/80" : "text-muted-foreground",
      )}>{note}</div>
    </div>
  );
}
