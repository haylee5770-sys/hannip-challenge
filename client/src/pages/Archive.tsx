import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Trophy, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Archive() {
  const { data: seasons, isLoading } = trpc.seasons.archive.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId !== null) {
    return <ArchiveDetail seasonId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-12">
      <section className="space-y-3 border-b hairline pb-10">
        <div className="editorial-eyebrow text-muted-foreground">ARCHIVE · 역대 챌린지</div>
        <h1 className="editorial-h1 text-5xl md:text-6xl tracking-tight leading-[1.05]">
          지나간 <span className="italic font-serif font-light">기수</span>들의
          <br />발자국.
        </h1>
        <p className="font-serif text-base md:text-lg text-muted-foreground max-w-2xl">
          종료된 시즌의 인증 카운트 1등, 감량 % 랭킹, 모두의 소감을 자유롭게 다시 볼 수 있어요.
        </p>
      </section>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : !seasons?.length ? (
        <Card className="rounded-none border-dashed p-12 text-center text-muted-foreground">
          아직 종료된 시즌이 없어요. 첫 챌린지가 끝나면 여기에 영구 보관됩니다.
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {seasons.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className="text-left border hairline p-6 md:p-7 hover:bg-secondary/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="editorial-eyebrow text-muted-foreground">
                    {s.seasonNumber ? `${s.seasonNumber}기` : "SEASON"}
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl group-hover:underline">{s.name}</h3>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {s.startDate} → {s.endDate} · {s.totalDays ?? 13}일
                  </div>
                </div>
                <Trophy className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArchiveDetail({ seasonId, onBack }: { seasonId: number; onBack: () => void }) {
  const { data, isLoading } = trpc.seasons.archiveDetail.useQuery({ seasonId });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.season) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack} className="rounded-none">
          <ArrowLeft className="h-4 w-4 mr-2" /> 역대 목록으로
        </Button>
        <Card className="rounded-none p-10 text-center text-muted-foreground">시즌 정보를 찾을 수 없어요.</Card>
      </div>
    );
  }

  const { season, lossEntries, countEntries, reports, champion } = data;

  return (
    <div className="space-y-12">
      <Button variant="ghost" onClick={onBack} className="rounded-none -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> 역대 목록으로
      </Button>

      {/* Hero */}
      <section className="border-b hairline pb-10 space-y-4">
        <div className="editorial-eyebrow text-muted-foreground">
          {season.seasonNumber ? `${season.seasonNumber}기 · ARCHIVED` : "ARCHIVED"}
        </div>
        <h1 className="editorial-h1 text-4xl md:text-5xl tracking-tight leading-[1.1]">{season.name}</h1>
        <div className="text-sm text-muted-foreground tabular-nums">
          {season.startDate} → {season.endDate} · 총 {season.totalDays ?? 13}일
        </div>
        {champion && (
          <div className="mt-6 inline-flex items-center gap-3 border hairline px-4 py-3 bg-amber-50">
            <Trophy className="h-5 w-5 text-amber-600" />
            <div>
              <div className="editorial-eyebrow text-muted-foreground">CHAMPION · 인증 1등</div>
              <div className="font-serif text-xl">{champion.name} · 총 {champion.totalCount}회 인증</div>
            </div>
          </div>
        )}
      </section>

      {/* Certification ranking — 모두 공개 */}
      <section className="space-y-4">
        <div className="editorial-eyebrow text-muted-foreground">CERTIFICATION COUNTS</div>
        <h2 className="editorial-h2 text-2xl md:text-3xl">인증 카운트 랭킹</h2>
        {countEntries.length === 0 ? (
          <Card className="rounded-none p-8 text-center text-muted-foreground">기록이 없어요.</Card>
        ) : (
          <div className="border-y hairline divide-y hairline">
            {countEntries.map((e, i) => (
              <div key={e.userId} className="py-4 grid grid-cols-12 items-center gap-3">
                <div className="col-span-1 flex items-center">
                  {i === 0 ? <Trophy className="h-5 w-5 text-amber-500" /> :
                   i === 1 ? <Trophy className="h-5 w-5 text-zinc-400" /> :
                   i === 2 ? <Trophy className="h-5 w-5 text-amber-700" /> :
                   <span className="editorial-eyebrow text-muted-foreground">#{i + 1}</span>}
                </div>
                <div className="col-span-5 font-serif text-lg">{e.name}</div>
                <div className="col-span-4 text-xs text-muted-foreground">
                  체중 {e.weightCount} · 식단 {e.mealCount} · 물 {(e as { waterCount?: number }).waterCount ?? 0} · 운동 {e.exerciseCount} · 수면 {e.sleepCount}
                </div>
                <div className="col-span-2 text-right font-serif text-2xl tabular-nums">{e.totalCount}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Loss % ranking */}
      <section className="space-y-4">
        <div className="editorial-eyebrow text-muted-foreground">WEIGHT LOSS %</div>
        <h2 className="editorial-h2 text-2xl md:text-3xl">감량 % 랭킹</h2>
        {lossEntries.length === 0 ? (
          <Card className="rounded-none p-8 text-center text-muted-foreground">기록이 없어요.</Card>
        ) : (
          <div className="border-y hairline divide-y hairline">
            {lossEntries.map((e, i) => (
              <div key={e.userId} className="py-4 grid grid-cols-12 items-center gap-3">
                <div className="col-span-1 editorial-eyebrow text-muted-foreground">#{i + 1}</div>
                <div className="col-span-5 font-serif text-lg">{e.name}</div>
                <div className="col-span-4 text-xs text-muted-foreground tabular-nums">
                  {e.baselineWeightKg ? `${e.baselineWeightKg.toFixed(1)}kg` : "—"}
                  {e.currentWeightKg ? ` → ${e.currentWeightKg.toFixed(1)}kg` : ""}
                </div>
                <div className="col-span-2 text-right font-serif text-2xl tabular-nums">
                  {e.lossPercent > 0 ? "−" : e.lossPercent < 0 ? "+" : ""}{Math.abs(e.lossPercent).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reflections */}
      <section className="space-y-4">
        <div className="editorial-eyebrow text-muted-foreground">REFLECTIONS</div>
        <h2 className="editorial-h2 text-2xl md:text-3xl">멤버들의 소감</h2>
        {reports.filter(r => r.isPublic && r.reflection).length === 0 ? (
          <Card className="rounded-none p-8 text-center text-muted-foreground">아직 공개된 소감이 없어요.</Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {reports
              .filter(r => r.isPublic && r.reflection)
              .map(r => (
                <Card key={r.userId} className="rounded-none p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt={r.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center font-serif text-sm">
                        {r.name?.[0] ?? "M"}
                      </div>
                    )}
                    <div className="font-serif text-base">{r.name}</div>
                  </div>
                  <p className="font-serif text-sm md:text-base whitespace-pre-wrap leading-relaxed">{r.reflection}</p>
                </Card>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
