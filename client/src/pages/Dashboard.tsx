import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
  BarChart, Bar, Legend, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayLocal } from "@shared/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const ranges = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "ALL", days: 9999 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState(30);

  const since = useMemo(() => {
    if (range >= 9999) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - range + 1);
    return formatDate(d);
  }, [range]);

  const today = todayLocal();
  const weights = trpc.weights.myHistory.useQuery({ sinceDate: since });
  const goal = trpc.goals.mine.useQuery();

  const myMeals = trpc.meals.byUserRange.useQuery(
    { userId: user?.id ?? 0, since: since ?? "1970-01-01", until: today },
    { enabled: !!user?.id }
  );
  const myEx = trpc.exercises.byUserRange.useQuery(
    { userId: user?.id ?? 0, since: since ?? "1970-01-01", until: today },
    { enabled: !!user?.id }
  );
  const sleeps = trpc.sleep.list.useQuery({ since });
  const waterRange = trpc.waters.myRange.useQuery(
    { since: since ?? "1970-01-01", until: today },
    { enabled: !!user }
  );
  const waterSeries = useMemo(() => {
    return (waterRange.data ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date.slice(5),
        full: r.date,
        ml: r.totalMl,
      }));
  }, [waterRange.data]);
  const hasWaterData = waterSeries.length > 0;
  const sleepSeries = useMemo(() => {
    return (sleeps.data ?? [])
      .slice()
      .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
      .map((s) => ({
        date: s.recordedDate.slice(5),
        full: s.recordedDate,
        hours: +(s.durationMinutes / 60).toFixed(2),
        durationMinutes: s.durationMinutes,
      }));
  }, [sleeps.data]);
  const hasSleepData = sleepSeries.length > 0;

  const weightSeries = useMemo(() => {
    return (weights.data ?? [])
      .slice()
      .sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
      .map(w => ({
        date: w.recordedDate.slice(5),
        weight: w.weightKg,
        muscle: w.skeletalMuscleKg ?? null,
        fat: w.bodyFatPercent ?? null,
        full: w.recordedDate,
      }));
  }, [weights.data]);

  const hasInbodyData = useMemo(() => weightSeries.some(p => p.muscle !== null || p.fat !== null), [weightSeries]);

  const latestWeight = weightSeries[weightSeries.length - 1]?.weight;
  const firstWeight = weightSeries[0]?.weight;
  const weightDelta = latestWeight && firstWeight ? latestWeight - firstWeight : 0;

  const progress = useMemo(() => {
    if (!goal.data || !latestWeight) return null;
    const start = Number(goal.data.startWeightKg);
    const target = Number(goal.data.targetWeightKg);
    const total = start - target;
    const done = start - latestWeight;
    if (total === 0) return 100;
    const pct = Math.max(0, Math.min(100, (done / total) * 100));
    return pct;
  }, [goal.data, latestWeight]);

  // Aggregate meals per day
  const mealDaily = useMemo(() => {
    const byDay: Record<string, { date: string; carbs: number; protein: number; fat: number; veg: number; water: number }> = {};
    for (const m of myMeals.data ?? []) {
      const d = m.recordedDate as unknown as string;
      if (!byDay[d]) byDay[d] = { date: d.slice(5), carbs: 0, protein: 0, fat: 0, veg: 0, water: 0 };
      byDay[d].carbs += m.carbsG;
      byDay[d].protein += m.proteinG;
      byDay[d].fat += m.fatG;
      byDay[d].veg += m.vegetableG;
      byDay[d].water += m.waterMl;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [myMeals.data]);

  // Aggregate exercise per day
  const exDaily = useMemo(() => {
    const byDay: Record<string, { date: string; minutes: number }> = {};
    for (const e of myEx.data ?? []) {
      const d = e.recordedDate as unknown as string;
      if (!byDay[d]) byDay[d] = { date: d.slice(5), minutes: 0 };
      byDay[d].minutes += e.durationMin;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [myEx.data]);

  return (
    <div>
      {/* Cover */}
      <section className="grid grid-cols-12 gap-6 items-end pb-10 border-b hairline">
        <div className="col-span-12 md:col-span-7">
          <div className="editorial-eyebrow text-muted-foreground mb-3">PERSONAL</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl">
            나의 <span className="italic font-serif font-light">변화</span>
          </h1>
        </div>
        <div className="col-span-12 md:col-span-5 flex md:justify-end gap-1">
          {ranges.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`editorial-eyebrow px-3 py-2 border hairline transition-colors ${range === r.days ? "bg-foreground text-background" : "hover:bg-secondary"}`}
              style={{ transitionDuration: "180ms" }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* Goal & summary */}
      <section className="grid grid-cols-12 gap-6 py-10 border-b hairline">
        <div className="col-span-12 md:col-span-4">
          <GoalCard
            goal={goal.data}
            latestWeight={latestWeight}
            progress={progress}
            onChanged={() => goal.refetch()}
          />
        </div>
        <SummaryCard
          className="col-span-6 md:col-span-2"
          label="LATEST"
          value={latestWeight ? latestWeight.toFixed(1) : "—"}
          unit="kg"
        />
        <SummaryCard
          className="col-span-6 md:col-span-2"
          label="CHANGE"
          value={firstWeight ? (weightDelta >= 0 ? "+" : "") + weightDelta.toFixed(1) : "—"}
          unit="kg"
        />
        <SummaryCard
          className="col-span-6 md:col-span-2"
          label="ENTRIES"
          value={String(weightSeries.length)}
          unit="DAYS"
        />
        <SummaryCard
          className="col-span-6 md:col-span-2"
          label="EXERCISE"
          value={String(exDaily.reduce((sum, d) => sum + d.minutes, 0))}
          unit="MIN"
        />
      </section>

      {/* Weight chart */}
      <section className="py-10 border-b hairline">
        <div className="editorial-eyebrow text-muted-foreground mb-2">01 · WEIGHT TREND</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">체중 변화</h2>
        <div className="border hairline p-4 bg-card">
          {weights.isLoading ? (
            <div className="h-72 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : weightSeries.length === 0 ? (
            <div className="h-72 flex items-center justify-center font-serif italic text-muted-foreground">
              아직 기록된 체중이 없어요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={weightSeries} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontFamily: "var(--font-serif)" }}
                  labelFormatter={(_, p) => p[0]?.payload?.full}
                  formatter={(v: number) => [`${v.toFixed(1)} kg`, "체중"]}
                />
                {goal.data && (
                  <ReferenceLine
                    y={Number(goal.data.targetWeightKg)}
                    stroke="var(--accent)"
                    strokeDasharray="3 3"
                    label={{ value: `목표 ${Number(goal.data.targetWeightKg).toFixed(1)}kg`, position: "right", fill: "var(--accent)", fontSize: 11, fontFamily: "var(--font-serif)" }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--foreground)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Inbody chart */}
      {hasInbodyData && (
        <section className="py-10 border-b hairline">
          <div className="editorial-eyebrow text-muted-foreground mb-2">02 · INBODY</div>
          <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">골격근량 · 체지방률</h2>
          <div className="border hairline p-4 bg-card">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weightSeries} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} domain={[0, 50]} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0 }}
                  labelFormatter={(_, p) => p[0]?.payload?.full}
                  formatter={(v: any, name: string) => {
                    if (v === null || v === undefined) return ["—", name];
                    if (name === "골격근량") return [`${Number(v).toFixed(1)} kg`, name];
                    if (name === "체지방률") return [`${Number(v).toFixed(1)} %`, name];
                    return [v, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="muscle" name="골격근량" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="fat" name="체지방률" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Sleep chart */}
      {hasSleepData && (
        <section className="py-10 border-b hairline">
          <div className="editorial-eyebrow text-muted-foreground mb-2">{hasInbodyData ? "03" : "02"} · SLEEP</div>
          <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">수면 추이</h2>
          <div className="border hairline p-4 bg-card">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sleepSeries} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} domain={[0, 12]} unit="h" />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0 }}
                  formatter={(v: number) => [`${v} h`, "수면"]}
                />
                <ReferenceLine y={5} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "5h", position: "insideTopRight", fill: "#dc2626", fontSize: 11 }} />
                <ReferenceLine y={7} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "7h", position: "insideTopRight", fill: "#16a34a", fontSize: 11 }} />
                <Bar dataKey="hours" name="수면(시간)">
                  {sleepSeries.map((entry, idx) => {
                    const m = entry.durationMinutes;
                    const fill = m < 300 ? "#f87171" : m >= 420 ? "#16a34a" : "#f59e0b";
                    return <Cell key={idx} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-muted-foreground flex gap-4">
              <span><span className="inline-block w-2 h-2 mr-1" style={{ background: "#f87171" }} />5시간 미만 · 위험</span>
              <span><span className="inline-block w-2 h-2 mr-1" style={{ background: "#f59e0b" }} />5–7시간 · 보통</span>
              <span><span className="inline-block w-2 h-2 mr-1" style={{ background: "#16a34a" }} />7시간 이상 · 안전</span>
            </div>
          </div>
        </section>
      )}

      {/* Water chart */}
      {hasWaterData && (
        <section className="py-10 border-b hairline">
          <div className="editorial-eyebrow text-muted-foreground mb-2">
            {[hasInbodyData, hasSleepData].filter(Boolean).length + 2 < 10
              ? String([hasInbodyData, hasSleepData].filter(Boolean).length + 2).padStart(2, "0")
              : ""} · WATER
          </div>
          <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">물 섭취 추이</h2>
          <div className="border hairline p-4 bg-card">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={waterSeries} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} unit="ml" />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0 }}
                  formatter={(v: number) => [`${v.toLocaleString()} ml`, "물 섭취"]}
                />
                <ReferenceLine y={2000} stroke="#0ea5e9" strokeDasharray="4 4" label={{ value: "2L 목표", position: "insideTopRight", fill: "#0ea5e9", fontSize: 11 }} />
                <Bar dataKey="ml" name="물 (ml)">
                  {waterSeries.map((entry, idx) => {
                    const fill = entry.ml >= 2000 ? "#0ea5e9" : entry.ml >= 1000 ? "#7dd3fc" : "#cbd5e1";
                    return <Cell key={idx} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-muted-foreground flex gap-4">
              <span><span className="inline-block w-2 h-2 mr-1" style={{ background: "#cbd5e1" }} />1L 미만</span>
              <span><span className="inline-block w-2 h-2 mr-1" style={{ background: "#7dd3fc" }} />1–2L</span>
              <span><span className="inline-block w-2 h-2 mr-1" style={{ background: "#0ea5e9" }} />2L 이상 · 목표 달성</span>
            </div>
          </div>
        </section>
      )}

      {/* Macros chart */}
      <section className="py-10 border-b hairline">
        <div className="editorial-eyebrow text-muted-foreground mb-2">{[hasInbodyData, hasSleepData, hasWaterData].filter(Boolean).length + 2} · MACROS</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">영양 섭취 추이</h2>
        <div className="border hairline p-4 bg-card">
          {mealDaily.length === 0 ? (
            <div className="h-72 flex items-center justify-center font-serif italic text-muted-foreground">
              기록된 식단이 없어요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mealDaily} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-sans)" }} />
                <Bar dataKey="carbs" name="탄수화물 (g)" fill="var(--chart-1)" stackId="a" />
                <Bar dataKey="protein" name="단백질 (g)" fill="var(--chart-2)" stackId="a" />
                <Bar dataKey="fat" name="지방 (g)" fill="var(--chart-3)" stackId="a" />
                <Bar dataKey="veg" name="야채 (g)" fill="var(--chart-4)" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Exercise chart */}
      <section className="py-10">
        <div className="editorial-eyebrow text-muted-foreground mb-2">{[hasInbodyData, hasSleepData, hasWaterData].filter(Boolean).length + 3} · MOVEMENT</div>
        <h2 className="editorial-h2 text-3xl md:text-4xl mb-6">운동 시간</h2>
        <div className="border hairline p-4 bg-card">
          {exDaily.length === 0 ? (
            <div className="h-60 flex items-center justify-center font-serif italic text-muted-foreground">
              기록된 운동이 없어요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={exDaily} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0 }}
                  formatter={(v: number) => [`${v} 분`, "운동"]}
                />
                <Bar dataKey="minutes" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function SummaryCard({ label, value, unit, className }: { label: string; value: string; unit: string; className?: string }) {
  return (
    <div className={`border hairline p-5 ${className ?? ""}`}>
      <div className="editorial-eyebrow text-muted-foreground mb-2">{label}</div>
      <div className="number-display text-3xl md:text-4xl">
        {value}<span className="text-base text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  latestWeight,
  progress,
  onChanged,
}: {
  goal: { startWeightKg: number; targetWeightKg: number; targetDate: string | null } | null | undefined;
  latestWeight: number | undefined;
  progress: number | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(goal ? String(goal.startWeightKg) : "");
  const [target, setTarget] = useState(goal ? String(goal.targetWeightKg) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");

  const upsert = trpc.goals.upsert.useMutation({
    onSuccess: () => {
      toast.success("목표가 저장되었습니다");
      setEditing(false);
      onChanged();
    },
  });

  if (!goal && !editing) {
    return (
      <div className="border hairline p-5 h-full flex flex-col">
        <div className="editorial-eyebrow text-muted-foreground mb-2">GOAL</div>
        <div className="font-serif italic text-muted-foreground mb-4">
          아직 목표가 설정되지 않았어요.
        </div>
        <Button onClick={() => setEditing(true)} className="rounded-none mt-auto" variant="outline">
          목표 설정
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="border hairline p-5">
        <div className="editorial-eyebrow text-muted-foreground mb-3">EDIT GOAL</div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">시작 체중</Label>
            <Input type="number" step="0.1" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-none" />
          </div>
          <div>
            <Label className="text-xs">목표 체중</Label>
            <Input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-none" />
          </div>
          <div>
            <Label className="text-xs">목표 날짜 (선택)</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="rounded-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" onClick={() => setEditing(false)} className="rounded-none">취소</Button>
          <Button
            className="rounded-none flex-1"
            disabled={upsert.isPending}
            onClick={() => {
              const s = parseFloat(start);
              const t = parseFloat(target);
              if (!Number.isFinite(s) || !Number.isFinite(t)) {
                toast.error("체중을 숫자로 입력해 주세요");
                return;
              }
              upsert.mutate({
                startWeightKg: s,
                targetWeightKg: t,
                targetDate: targetDate || null,
              });
            }}
          >
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border hairline p-5">
      <div className="flex justify-between items-baseline mb-3">
        <div className="editorial-eyebrow text-muted-foreground">GOAL</div>
        <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">편집</button>
      </div>
      <div className="font-serif italic text-sm text-muted-foreground mb-1">
        {Number(goal!.startWeightKg).toFixed(1)} kg → 목표
      </div>
      <div className="number-display text-4xl mb-4">
        {Number(goal!.targetWeightKg).toFixed(1)}<span className="text-base text-muted-foreground ml-1">kg</span>
      </div>
      {progress !== null && (
        <>
          <div className="h-1 bg-secondary mb-2 relative">
            <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${progress}%`, transitionTimingFunction: "var(--ease-out)" }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>달성률</span>
            <span className="number-display">{progress.toFixed(0)}%</span>
          </div>
        </>
      )}
      {latestWeight && (
        <div className="font-serif italic text-sm text-muted-foreground mt-3">
          현재 {latestWeight.toFixed(1)} kg
        </div>
      )}
    </div>
  );
}
