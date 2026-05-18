import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Lock,
  Sparkles,
  Trophy,
  Award,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function formatPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (v > 0) return `−${v.toFixed(2)}%`;
  if (v < 0) return `+${Math.abs(v).toFixed(2)}%`;
  return "0.00%";
}

export default function SeasonReport() {
  const myReport = trpc.seasons.myReport.useQuery();
  const utils = trpc.useUtils();

  const [reflection, setReflection] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (myReport.data?.report && !hydrated) {
      setReflection(myReport.data.report.reflection ?? "");
      setIsPublic(myReport.data.report.isPublic ?? true);
      setHydrated(true);
    }
  }, [myReport.data, hydrated]);

  const save = trpc.seasons.saveReflection.useMutation({
    onSuccess: () => {
      utils.seasons.myReport.invalidate();
      utils.seasons.publicReports.invalidate();
      toast.success("소감을 저장했어요");
    },
    onError: (e) => toast.error(e.message),
  });

  // For weight/SM/BF chart, fetch user's weight history.
  const myWeights = trpc.weights.myHistory.useQuery();

  const chartData = useMemo(() => {
    if (!myReport.data?.season || !myWeights.data) return [];
    const start = myReport.data.season.startDate;
    const end = myReport.data.season.endDate;
    return myWeights.data
      .filter(w => w.recordedDate >= start && w.recordedDate <= end)
      .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
      .map(w => ({
        date: w.recordedDate.slice(5),
        weight: w.weightKg,
        sm: w.skeletalMuscleKg,
        bf: w.bodyFatPercent,
      }));
  }, [myReport.data, myWeights.data]);

  if (myReport.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const data = myReport.data;

  // Locked / no report yet
  if (!data || data.locked) {
    const season = data?.season;
    const today = new Date().toISOString().slice(0, 10);
    const daysUntil = season
      ? Math.max(
          0,
          Math.ceil(
            (new Date(season.endDate).getTime() - new Date(today).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    return (
      <div>
        <header className="pb-10 border-b hairline">
          <div className="editorial-eyebrow text-muted-foreground mb-3">SEASON · REPORT</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl">
            결과 <span className="italic font-serif font-light">리포트</span>
          </h1>
          <p className="mt-4 font-serif italic text-lg text-muted-foreground">
            13일 챌린지가 끝나면 지난 시즌의 변화를 한눈에 확인할 수 있어요.
          </p>
        </header>
        <div className="py-16">
          <Card className="rounded-none border-dashed border hairline p-12 text-center max-w-2xl mx-auto bg-secondary/40">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="mt-6 editorial-h2 text-2xl md:text-3xl">아직 잠겨 있어요</h2>
            {season ? (
              <>
                <p className="mt-3 font-serif italic text-muted-foreground">
                  <span className="text-foreground font-sans">{season.name}</span>이(가) 끝나면 결과 리포트가 공개됩니다.
                </p>
                <div className="mt-6 number-display text-5xl md:text-6xl">
                  D − {daysUntil}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  종료일: {new Date(season.endDate).toLocaleDateString("ko-KR")}
                </p>
              </>
            ) : (
              <p className="mt-3 font-serif italic text-muted-foreground">
                현재 진행 중인 시즌이 없어요.
              </p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Unlocked
  const r = data.report!;
  const beforeFront = data.photos.find(p => p.slot === "before" && p.angle === "front");
  const beforeSide = data.photos.find(p => p.slot === "before" && p.angle === "side");
  const afterFront = data.photos.find(p => p.slot === "after" && p.angle === "front");
  const afterSide = data.photos.find(p => p.slot === "after" && p.angle === "side");

  const lossPct = r.lossPercent ? parseFloat(r.lossPercent) : 0;
  const baseline = r.baselineWeightKg ? parseFloat(r.baselineWeightKg) : null;
  const finalW = r.finalWeightKg ? parseFloat(r.finalWeightKg) : null;
  const lossKg = baseline && finalW ? baseline - finalW : 0;

  return (
    <div className="space-y-12">
      {/* HERO */}
      <header className="pb-10 border-b hairline">
        <div className="editorial-eyebrow text-muted-foreground mb-3 flex items-center gap-2">
          <Sparkles className="h-3 w-3" /> SEASON · REPORT
        </div>
        <h1 className="editorial-h1 text-5xl md:text-7xl">
          나의 <span className="italic font-serif font-light">변화</span>
        </h1>
        <p className="mt-4 font-serif italic text-lg text-muted-foreground">
          {data.season!.name} · {new Date(data.season!.startDate).toLocaleDateString("ko-KR")} —{" "}
          {new Date(data.season!.endDate).toLocaleDateString("ko-KR")}
        </p>
      </header>

      {/* KEY METRICS */}
      <section className="grid grid-cols-12 gap-6">
        <MetricCard
          eyebrow="LOSS · 감량률"
          value={formatPct(lossPct)}
          subtitle={baseline && finalW ? `${baseline.toFixed(1)} → ${finalW.toFixed(1)} kg` : "—"}
          highlight={lossPct > 0}
        />
        <MetricCard
          eyebrow="LOSS · 감량 kg"
          value={`${lossKg > 0 ? "−" : lossKg < 0 ? "+" : ""}${Math.abs(lossKg).toFixed(2)} kg`}
          subtitle="베이스라인 대비"
          highlight={lossKg > 0}
        />
        <MetricCard
          eyebrow="SCORE · 참여 점수"
          value={`${r.participationScore}`}
          subtitle={r.completed ? "13일 풀 출석" : "참여 인증 합계"}
          highlight={r.completed}
        />
      </section>

      {/* BEFORE / AFTER */}
      <section>
        <div className="editorial-eyebrow text-muted-foreground mb-3">BEFORE · AFTER</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">변화의 기록</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BAImage label="BEFORE · 전면" url={beforeFront?.photoUrl} />
          <BAImage label="BEFORE · 측면" url={beforeSide?.photoUrl} />
          <BAImage label="AFTER · 전면" url={afterFront?.photoUrl} />
          <BAImage label="AFTER · 측면" url={afterSide?.photoUrl} />
        </div>

        {/* 줄자 기록 */}
        <WaistRecord seasonId={data.season!.id} />
      </section>

      {/* CHART */}
      <section>
        <div className="editorial-eyebrow text-muted-foreground mb-3">TREND · 13일 추이</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">체중 · 골격근 · 체지방</h2>
        <div className="border hairline p-4 bg-card">
          {chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center font-serif italic text-muted-foreground">
              시즌 동안 기록된 체중이 없어요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="right" orientation="right" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="weight"
                  name="체중(kg)"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sm"
                  name="골격근량(kg)"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="bf"
                  name="체지방률(%)"
                  stroke="#b45309"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* COUNTS */}
      <section>
        <div className="editorial-eyebrow text-muted-foreground mb-3">CERTIFICATION · 인증 횟수</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">꾸준함의 증거</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <CountTile label="기상 (체중)" value={r.weightCount} icon={<Trophy className="h-4 w-4" />} />
          <CountTile label="식단" value={r.mealCount} icon={<Award className="h-4 w-4" />} />
          <CountTile label="물" value={(r as { waterCount?: number }).waterCount ?? 0} icon={<Sparkles className="h-4 w-4" />} />
          <CountTile label="운동" value={r.exerciseCount} icon={<Sparkles className="h-4 w-4" />} />
          <CountTile label="수면" value={(r as { sleepCount?: number }).sleepCount ?? 0} icon={<Sparkles className="h-4 w-4" />} />
          <CountTile label="합계" value={r.totalCount} icon={<Trophy className="h-4 w-4" />} highlight />
        </div>
        {r.completed && (
          <div className="mt-4 inline-flex items-center gap-2 border hairline px-3 py-1.5 bg-emerald-50 text-emerald-900 text-sm">
            <Trophy className="h-4 w-4" /> 13일 풀 출석 보너스 +13점 적용
          </div>
        )}
      </section>

      {/* REFLECTION */}
      <section>
        <div className="editorial-eyebrow text-muted-foreground mb-3">REFLECTION · 소감</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">나의 한마디</h2>
        <Card className="rounded-none border hairline p-6 space-y-4">
          <div>
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">
              이번 시즌을 마치며
            </Label>
            <Textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value.slice(0, 2000))}
              placeholder="이번 13일 동안 느낀 점, 가장 힘들었던 순간, 다음 시즌의 다짐 등을 자유롭게 적어 주세요."
              rows={6}
              className="rounded-none border-foreground/30"
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {reflection.length} / 2000
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="public" className="text-sm">
                멤버에게 공개 (체중 변화 · 인증 횟수 · 소감)
              </Label>
            </div>
            <Button
              onClick={() => save.mutate({
                seasonId: data.season!.id,
                reflection: reflection.trim(),
                isPublic,
              })}
              disabled={save.isPending}
              className="rounded-none uppercase tracking-wider"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground italic">
            기록의 상세(식단/운동 내역)는 본인만 열람할 수 있어요. 공개 리포트에는 체중 변화, 카테고리별 인증 횟수, 소감만 노출됩니다.
          </p>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  eyebrow,
  value,
  subtitle,
  highlight,
}: {
  eyebrow: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "col-span-12 sm:col-span-4 rounded-none border hairline p-6",
        highlight && "bg-foreground text-background",
      )}
    >
      <div className={cn("editorial-eyebrow", highlight ? "text-background/70" : "text-muted-foreground")}>
        {eyebrow}
      </div>
      <div className="mt-3 number-display text-4xl md:text-5xl tabular-nums">{value}</div>
      {subtitle && (
        <div
          className={cn(
            "mt-2 text-sm font-serif italic",
            highlight ? "text-background/70" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </div>
      )}
    </Card>
  );
}

function BAImage({ label, url }: { label: string; url?: string }) {
  return (
    <div className="space-y-2">
      <div className="editorial-eyebrow text-muted-foreground text-xs">{label}</div>
      <div className="aspect-[3/4] border hairline overflow-hidden bg-secondary/40 flex items-center justify-center">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-60" />
            <div className="text-xs font-serif italic">사진 없음</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CountTile({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "border hairline p-5",
        highlight && "bg-foreground text-background",
      )}
    >
      <div className={cn("flex items-center gap-2 editorial-eyebrow", highlight ? "text-background/70" : "text-muted-foreground")}>
        {icon} {label}
      </div>
      <div className="mt-2 number-display text-4xl tabular-nums">{value}</div>
    </div>
  );
}

/* ── 줄자 기록 컴포넌트 ── */
function WaistRecord({ seasonId }: { seasonId: number }) {
  const save = trpc.seasons.saveWaist.useMutation({
    onSuccess: () => { toast.success("허리 둘레를 저장했어요"); waist.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const waist = trpc.seasons.myWaist.useQuery({ seasonId });
  const [beforeCm, setBeforeCm] = useState("");
  const [afterCm, setAfterCm] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (waist.data && !hydrated) {
      setBeforeCm(waist.data.beforeCm?.toString() ?? "");
      setAfterCm(waist.data.afterCm?.toString() ?? "");
      setHydrated(true);
    }
  }, [waist.data, hydrated]);

  const diff = (() => {
    const b = parseFloat(beforeCm);
    const a = parseFloat(afterCm);
    if (!Number.isFinite(b) || !Number.isFinite(a)) return null;
    return +(b - a).toFixed(1);
  })();

  return (
    <div className="mt-6 border hairline p-5 space-y-4 bg-secondary/20">
      <div>
        <div className="editorial-eyebrow text-muted-foreground mb-1">WAIST · 허리 둘레</div>
        <p className="text-xs text-muted-foreground font-serif italic leading-relaxed">
          체중은 안 빠져도 허리는 줄어있는 경우가 많아요. 허리 둘레를 체크해보세요.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          첫날과 마지막날 측정을 권장해요. 중간 추가 측정은 본인 선택이에요.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">BEFORE · 시작 (cm)</label>
          <input
            type="number"
            step="0.1"
            placeholder="예: 82.5"
            value={beforeCm}
            onChange={e => setBeforeCm(e.target.value)}
            className="w-full border border-foreground/30 bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <div>
          <label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">AFTER · 마지막 (cm)</label>
          <input
            type="number"
            step="0.1"
            placeholder="예: 79.0"
            value={afterCm}
            onChange={e => setAfterCm(e.target.value)}
            className="w-full border border-foreground/30 bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
      </div>
      {diff !== null && (
        <div className={cn(
          "text-center font-serif text-2xl tabular-nums",
          diff > 0 ? "text-emerald-700" : diff < 0 ? "text-rose-700" : "text-muted-foreground"
        )}>
          {diff > 0 ? `−${diff} cm 감소` : diff < 0 ? `+${Math.abs(diff)} cm 증가` : "변화 없음"}
        </div>
      )}
      <Button
        onClick={() => save.mutate({
          seasonId,
          beforeCm: beforeCm ? parseFloat(beforeCm) : null,
          afterCm: afterCm ? parseFloat(afterCm) : null,
        })}
        disabled={save.isPending}
        variant="outline"
        className="w-full rounded-none"
      >
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
      </Button>
    </div>
  );
}
