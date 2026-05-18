import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Sparkles, X, Camera, ScanLine } from "lucide-react";
import { todayLocal } from "@shared/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";

type FeedbackTone = "warning" | "info" | "praise";
type FeedbackItem = { tone: FeedbackTone; text: string };
type ScaleType = "regular" | "inbody_dial" | "inbody_other";

const CATEGORIES = [
  { value: "regular", label: "일반식", caption: "REGULAR MEAL" },
  { value: "smoothie", label: "스무디", caption: "SMOOTHIE" },
  { value: "breakfast", label: "아침", caption: "BREAKFAST" },
  { value: "lunch", label: "점심", caption: "LUNCH" },
  { value: "dinner", label: "저녁", caption: "DINNER" },
  { value: "snack", label: "간식", caption: "SNACK" },
] as const;

type MealCategory =
  | "regular"
  | "smoothie"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack";

export default function Today() {
  const [date] = useState<string>(() => todayLocal());
  const utils = trpc.useUtils();

  // Weight state
  const myWeights = trpc.weights.myHistory.useQuery();
  const todayWeight = myWeights.data?.find(w => w.recordedDate === date);
  // 어제 체중 (코멘트 계산용)
  const yesterdayDate = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [date]);
  const yesterdayWeight = myWeights.data?.find(w => w.recordedDate === yesterdayDate);
  const [weightKg, setWeightKg] = useState<string>("");
  const weightDeltaInfo = useMemo(() => {
    // 입력 중이면 입력값을 우선으로, 아니면 저장된 오늘 마지막 기록을 기준으로 비교
    const typed = parseFloat(weightKg);
    const today = Number.isFinite(typed)
      ? typed
      : (todayWeight ? parseFloat(String(todayWeight.weightKg)) : null);
    const yest = yesterdayWeight ? parseFloat(String(yesterdayWeight.weightKg)) : null;
    if (today == null || !Number.isFinite(today)) return null;
    if (yest == null) return null;
    const deltaG = Math.round((today - yest) * 1000);
    if (deltaG === 0) return null;
    if (deltaG < 0) {
      return { deltaG, message: `-${Math.abs(deltaG)}g 삭제 성공. 오늘 이걸 망칠 순 없다!`, tone: "loss" as const };
    }
    return { deltaG, message: `+${deltaG}g 지금은 다지는 중. 오늘 이걸 만회할 수 있다!`, tone: "gain" as const };
  }, [weightKg, todayWeight, yesterdayWeight]);
  const [scaleType, setScaleType] = useState<ScaleType>("regular");
  const [skeletalMuscleKg, setSkeletalMuscleKg] = useState<string>("");
  const [bodyFatPercent, setBodyFatPercent] = useState<string>("");
  const [inbodyPhotoBase64, setInbodyPhotoBase64] = useState<string | null>(null);
  const [inbodyAnalyzing, setInbodyAnalyzing] = useState(false);
  const inbodyFileRef = useRef<HTMLInputElement>(null);

  const upsertWeight = trpc.weights.upsert.useMutation({
    onSuccess: () => {
      utils.weights.myHistory.invalidate();
      utils.feed.today.invalidate();
      utils.seasons.myProgress.invalidate();
      toast.success("체중이 기록되었습니다");
      setInbodyPhotoBase64(null);
      if (inbodyFileRef.current) inbodyFileRef.current.value = "";
    },
  });

  const analyzeInbody = trpc.weights.analyzeInbody.useMutation();

  // Goal
  const goal = trpc.goals.mine.useQuery();

  // Meals today
  const myMealsToday = trpc.meals.byMeDate.useQuery({ date });
  const myExercisesToday = trpc.exercises.byMeDate.useQuery({ date });

  const handleSaveWeight = () => {
    const v = parseFloat(weightKg);
    if (!Number.isFinite(v)) {
      toast.error("체중을 숫자로 입력해 주세요");
      return;
    }
    // 모든 유형에서 사진 필수 (거짓 기록 방지)
    const hasPhoto = !!inbodyPhotoBase64 || !!todayWeight?.inbodyPhotoUrl;
    if (!hasPhoto) {
      toast.error("체중계 사진을 먼저 업로드해 주세요. 사진 인증이 필수입니다.");
      return;
    }
    const sm = scaleType !== "regular" ? parseFloat(skeletalMuscleKg) : NaN;
    const bf = scaleType !== "regular" ? parseFloat(bodyFatPercent) : NaN;
    upsertWeight.mutate({
      recordedDate: date,
      weightKg: v,
      skeletalMuscleKg: Number.isFinite(sm) ? sm : null,
      bodyFatPercent: Number.isFinite(bf) ? bf : null,
      inbodyPhotoBase64: inbodyPhotoBase64 ?? undefined,
    });
    setWeightKg("");
    setSkeletalMuscleKg("");
    setBodyFatPercent("");
  };

  const handleInbodyFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB 이하 이미지만 업로드할 수 있어요.");
      return;
    }

    // 웅일 다운스케일/업스케일 — LLM 비전이 카드 글자를 더 잘 읽도록 보정.
    // 장변이 1600px 이하일 때는 1600px로 업스케일, 1600 초과면 1600px로 다운스케일.
    const normalize = async (rawDataUrl: string): Promise<string> => {
      try {
        const img = new Image();
        const ready = new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("image load failed"));
        });
        img.src = rawDataUrl;
        await ready;
        const TARGET = 1600;
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        if (longest === 0) return rawDataUrl;
        const ratio = TARGET / longest;
        const w = Math.round(img.naturalWidth * ratio);
        const h = Math.round(img.naturalHeight * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return rawDataUrl;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", 0.92);
      } catch {
        return rawDataUrl;
      }
    };

    const reader = new FileReader();
    reader.onload = async () => {
      const rawBase64 = reader.result as string;
      const base64 = await normalize(rawBase64);
      setInbodyPhotoBase64(base64);

      // 인바디 다이얼만 AI 자동 인식 실행
      if (scaleType === "inbody_dial") {
        setInbodyAnalyzing(true);
        try {
          const result = await analyzeInbody.mutateAsync({ photoBase64: base64 });
          if (result.weightKg !== null) setWeightKg(result.weightKg.toFixed(1));
          if (result.skeletalMuscleKg !== null) setSkeletalMuscleKg(result.skeletalMuscleKg.toFixed(1));
          if (result.bodyFatPercent !== null) setBodyFatPercent(result.bodyFatPercent.toFixed(1));
          const got = [
            result.weightKg !== null ? "체중" : null,
            result.skeletalMuscleKg !== null ? "근골격" : null,
            result.bodyFatPercent !== null ? "체지방률" : null,
          ].filter(Boolean);
          if (got.length === 3) {
            toast.success(`AI 인식 완료: ${got.join(", ")} · 값이 맞는지 확인 후 저장해 주세요`);
          } else if (got.length > 0) {
            toast.success(`일부 인식: ${got.join(", ")} · 나머지는 직접 입력해 주세요`);
          } else {
            toast.warning("자동 인식이 어려웠어요. 인바디 다이얼 화면을 화면 가득 잡히도록 재촬영 후 다시 올려보세요. 인식이 안 되면 직접 입력 후 사진은 증거로 유지됩니다.");
          }
        } catch (e: any) {
          toast.error(e?.message ?? "분석 중 오류가 발생했어요.");
        } finally {
          setInbodyAnalyzing(false);
        }
      } else {
        toast.success("사진이 등록되었어요. 체중을 입력 후 저장해 주세요.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Season progress (live)
  const seasonProgress = trpc.seasons.myProgress.useQuery(undefined, { refetchInterval: 60_000 });
  // 스트릭 + 주간 요약
  const myStreak = trpc.seasons.myStreak.useQuery(undefined, { refetchOnWindowFocus: false });
  const weeklyNudge = trpc.seasons.weeklyNudge.useQuery(undefined, { refetchOnWindowFocus: false });

  return (
    <div>
      {/* 주간 AI 요약 + 스트릭 */}
      {(weeklyNudge.data || (myStreak.data?.streak ?? 0) >= 2) && (
        <div className={cn(
          "mb-4 px-5 py-3 flex items-start gap-3 border hairline",
          weeklyNudge.data?.type === "praise" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
        )}>
          <span className="text-xl mt-0.5">
            {weeklyNudge.data?.type === "praise" ? "🌟" : "💪"}
          </span>
          <div className="flex-1">
            <p className="text-sm leading-relaxed text-foreground/90">
              {weeklyNudge.data?.text ?? ""}
            </p>
          </div>
          {(myStreak.data?.streak ?? 0) >= 2 && (
            <div className="flex flex-col items-center shrink-0 ml-2">
              <span className="text-xl">🔥</span>
              <span className="text-xs font-serif tabular-nums text-foreground/70">{myStreak.data?.streak}일</span>
            </div>
          )}
        </div>
      )}

      {/* Season banner */}
      {seasonProgress.data?.season && (
        <section className="mb-8 border hairline bg-secondary/40 px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="editorial-eyebrow text-muted-foreground">SEASON</div>
                <div className="font-serif text-xl md:text-2xl">{seasonProgress.data.season.name}</div>
              </div>
              <div className="hidden md:block w-px h-10 bg-border" />
              <div>
                <div className="editorial-eyebrow text-muted-foreground">DAY</div>
                <div className="font-serif text-xl md:text-2xl tabular-nums">
                  {seasonProgress.data.dayNumber ?? "-"} <span className="text-muted-foreground text-sm">/ {seasonProgress.data.totalDays}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3 md:gap-6 text-center md:text-right">
              <div>
                <div className="editorial-eyebrow text-muted-foreground">기상</div>
                <div className="font-serif text-xl tabular-nums">{seasonProgress.data.counts.weight}</div>
              </div>
              <div>
                <div className="editorial-eyebrow text-muted-foreground">식단</div>
                <div className="font-serif text-xl tabular-nums">{seasonProgress.data.counts.meal}</div>
              </div>
              <div>
                <div className="editorial-eyebrow text-muted-foreground">물</div>
                <div className="font-serif text-xl tabular-nums">{seasonProgress.data.counts.water ?? 0}</div>
              </div>
              <div>
                <div className="editorial-eyebrow text-muted-foreground">운동</div>
                <div className="font-serif text-xl tabular-nums">{seasonProgress.data.counts.exercise}</div>
              </div>
              <div>
                <div className="editorial-eyebrow text-muted-foreground">감량</div>
                <div className={cn(
                  "font-serif text-xl tabular-nums",
                  seasonProgress.data.lossPercent > 0 ? "text-emerald-700" : seasonProgress.data.lossPercent < 0 ? "text-rose-700" : "",
                )}>
                  {seasonProgress.data.lossPercent > 0 ? "−" : seasonProgress.data.lossPercent < 0 ? "+" : ""}{Math.abs(seasonProgress.data.lossPercent).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Editorial cover */}
      <section className="grid grid-cols-12 gap-6 items-end pb-10 border-b hairline">
        <div className="col-span-12 md:col-span-7">
          <div className="editorial-eyebrow text-muted-foreground mb-3">
            VOL. {new Date().getFullYear()} · TODAY
          </div>
          <h1 className="editorial-h1 text-5xl md:text-7xl lg:text-8xl">
            어제 <span className="italic font-serif font-light">노력의 결과</span>
          </h1>
          <p className="mt-4 font-serif italic text-lg md:text-xl text-muted-foreground">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 md:text-right">
          <div className="editorial-eyebrow text-muted-foreground mb-2">TODAY'S WEIGHT</div>
          <div className="number-display text-5xl md:text-6xl">
            {todayWeight ? `${todayWeight.weightKg.toFixed(1)}` : "—"}
            <span className="text-2xl text-muted-foreground ml-1">kg</span>
          </div>
          {goal.data && (
            <div className="font-serif italic text-sm text-muted-foreground mt-1">
              목표 {Number(goal.data.targetWeightKg).toFixed(1)} kg
            </div>
          )}
        </div>
      </section>

      {/* Weight quick input */}
      <section className="py-10 border-b hairline">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <div className="editorial-eyebrow text-muted-foreground mb-2">01 · WEIGHT</div>
            <h2 className="editorial-h2 text-3xl md:text-4xl flex items-baseline gap-3">
              체중 기록
              {seasonProgress.data?.counts.weight != null && (
                <span className="text-base font-sans font-normal text-blue-500 tabular-nums">
                  {seasonProgress.data.counts.weight}회
                </span>
              )}
            </h2>
            <p className="mt-3 font-serif italic text-muted-foreground text-sm">
              사진 업로드 필수. 매일 같은 시간에 측정하면 더 정확해요.
            </p>
          </div>
          <div className="col-span-12 md:col-span-8 space-y-6">
            {/* Scale type selector */}
            <div>
              <div className="editorial-eyebrow text-muted-foreground mb-2">체중계 종류 선택</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "regular" as const, label: "일반체중계" },
                  { value: "inbody_dial" as const, label: "인바디 다이얼" },
                  { value: "inbody_other" as const, label: "인바디 외 기기" },
                ] as { value: ScaleType; label: string }[]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setScaleType(value);
                      setWeightKg("");
                      setSkeletalMuscleKg("");
                      setBodyFatPercent("");
                      setInbodyPhotoBase64(null);
                      if (inbodyFileRef.current) inbodyFileRef.current.value = "";
                    }}
                    className={cn(
                      "border hairline px-2 py-3 text-sm transition-colors text-center",
                      scaleType === value
                        ? "bg-foreground text-background border-foreground"
                        : "hover:bg-secondary/40"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 font-serif italic text-xs text-muted-foreground">
                {scaleType === "regular" && "체중만 기록합니다. 체중계 화면 사진 필수."}
                {scaleType === "inbody_dial" && "사진 업로드 시 AI가 체중·근골격·체지방률을 자동 인식합니다."}
                {scaleType === "inbody_other" && "인바디 외 기기 사진 필수. 체중·근골격·체지방률을 직접 입력해 주세요."}
              </p>
            </div>

            {/* Photo upload — mandatory for all types */}
            <div className="border hairline p-4 bg-card/40">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="editorial-eyebrow text-muted-foreground mb-1">
                    {scaleType === "inbody_dial" ? "인바디 다이얼 사진" : "체중계 사진"} · 필수
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {scaleType === "inbody_dial"
                      ? <>인바디 다이얼 화면을 캡처해 올려주세요. AI가 <span className="text-foreground">체중·근골격·체지방률</span>을 자동 인식해요. 카드 영역만 꽉 차게 찍으면 인식률이 높아집니다.</>
                      : "체중계 화면 사진을 올려주세요. 정직한 기록이 챌린지의 기본입니다."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={inbodyFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleInbodyFile(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => inbodyFileRef.current?.click()}
                    disabled={inbodyAnalyzing}
                    className="rounded-none uppercase tracking-wider"
                  >
                    {inbodyAnalyzing ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />AI 인식 중</>
                    ) : inbodyPhotoBase64 ? (
                      <><Camera className="h-4 w-4 mr-2" />다른 사진 선택</>
                    ) : (
                      <><Camera className="h-4 w-4 mr-2" />사진 올리기</>
                    )}
                  </Button>
                </div>
              </div>
              {inbodyPhotoBase64 && (
                <div className="mt-4 flex items-start gap-4">
                  <img
                    src={inbodyPhotoBase64}
                    alt="체중계 미리보기"
                    className="w-32 h-32 object-cover border hairline"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      저장 시 이 사진이 인증 증거로 기록됩니다.
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInbodyPhotoBase64(null);
                        setSkeletalMuscleKg("");
                        setBodyFatPercent("");
                        if (inbodyFileRef.current) inbodyFileRef.current.value = "";
                      }}
                      className="rounded-none"
                    >
                      <X className="h-3 w-3 mr-1" />제거
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Input fields — vary by scale type */}
            <div className={cn(
              "grid gap-4",
              scaleType === "regular" ? "grid-cols-1 max-w-xs" : "grid-cols-1 sm:grid-cols-3"
            )}>
              <div>
                <Label className="editorial-eyebrow text-muted-foreground">체중 (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder={scaleType === "inbody_dial" ? "AI 자동 입력" : "직접 입력 (kg)"}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="rounded-none border-0 border-b border-foreground/30 px-0 text-2xl number-display h-12 focus-visible:ring-0 focus-visible:border-foreground bg-transparent"
                />
              </div>
              {scaleType !== "regular" && (
                <>
                  <div>
                    <Label className="editorial-eyebrow text-muted-foreground">
                      근골격 (kg){scaleType === "inbody_dial" && <span className="ml-1 text-xs opacity-50">자동인식</span>}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={scaleType === "inbody_dial" ? "AI 자동 입력" : "직접 입력 (kg)"}
                      value={skeletalMuscleKg}
                      onChange={(e) => setSkeletalMuscleKg(e.target.value)}
                      className="rounded-none border-0 border-b border-foreground/30 px-0 text-2xl number-display h-12 focus-visible:ring-0 focus-visible:border-foreground bg-transparent"
                    />
                  </div>
                  <div>
                    <Label className="editorial-eyebrow text-muted-foreground">
                      체지방률 (%){scaleType === "inbody_dial" && <span className="ml-1 text-xs opacity-50">자동인식</span>}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={scaleType === "inbody_dial" ? "AI 자동 입력" : "직접 입력 (%)"}
                      value={bodyFatPercent}
                      onChange={(e) => setBodyFatPercent(e.target.value)}
                      className="rounded-none border-0 border-b border-foreground/30 px-0 text-2xl number-display h-12 focus-visible:ring-0 focus-visible:border-foreground bg-transparent"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveWeight}
                disabled={upsertWeight.isPending}
                className="rounded-none px-8 h-12 uppercase tracking-wider"
              >
                {upsertWeight.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "인증하기"}
              </Button>
            </div>
            {weightDeltaInfo && (
              <div className={cn(
                "border hairline px-4 py-3 flex items-center gap-3 text-sm",
                weightDeltaInfo.tone === "loss"
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-rose-50/60 border-rose-200 text-rose-900",
              )}>
                <span className="editorial-eyebrow">
                  {weightDeltaInfo.tone === "loss" ? "YESTERDAY → TODAY" : "YESTERDAY → TODAY"}
                </span>
                <span className="number-display tabular-nums">
                  {weightDeltaInfo.deltaG > 0 ? `+${weightDeltaInfo.deltaG}g` : `${weightDeltaInfo.deltaG}g`}
                </span>
                <span className="font-serif italic">{weightDeltaInfo.message}</span>
              </div>
            )}
            {todayWeight?.inbodyPhotoUrl && !inbodyPhotoBase64 && (
              <div className="text-xs text-muted-foreground italic">
                오늘 사진이 이미 등록되었어요. 새 사진을 올리면 덮어쓰기됩니다.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Sleep — 수면 기록 (체중 아래) */}
      <SleepSection date={date} sleepCount={seasonProgress.data?.counts.sleep} />

      {/* Season photos (Before / Progress / After) */}
      <SeasonPhotosSection />

      {/* Meals — 식단 기록 (독립 섹션) */}
      <section className="py-10 border-b hairline">
        <div className="editorial-eyebrow text-muted-foreground mb-6">02 · MEALS</div>
        <MealsSection
          date={date}
          meals={myMealsToday.data ?? []}
          mealCount={seasonProgress.data?.counts.meal ?? myMealsToday.data?.length}
          onChange={() => {
            utils.meals.byMeDate.invalidate();
            utils.feed.today.invalidate();
            utils.seasons.myProgress.invalidate();
          }}
        />
      </section>

      {/* Water — 물 기록 (사진 + 용량, 독립 섹션) */}
      <section className="py-10 border-b hairline">
        <div className="editorial-eyebrow text-muted-foreground mb-6">03 · WATER</div>
        <WaterSection date={date} waterCount={seasonProgress.data?.counts.water ?? undefined} />
      </section>

      {/* Exercise — 운동 기록 (식단·물과 동일 위계의 독립 섹션) */}
      <section className="py-10">
        <div className="editorial-eyebrow text-muted-foreground mb-6">04 · EXERCISE</div>
        <ExerciseSection
          date={date}
          exercises={myExercisesToday.data ?? []}
          exerciseCount={seasonProgress.data?.counts.exercise ?? myExercisesToday.data?.length}
          onChange={() => {
            utils.exercises.byMeDate.invalidate();
            utils.feed.today.invalidate();
            utils.seasons.myProgress.invalidate();
          }}
        />
      </section>
    </div>
  );
}

/* ----------------- Meals Section ----------------- */
type MealRow = {
  id: number;
  category: MealCategory;
  description: string | null;
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;
  waterMl: number;
  aiComment: string | null;
  photos: { id: number; url: string }[];
};

function MealsSection({
  date,
  meals,
  mealCount,
  onChange,
}: {
  date: string;
  meals: MealRow[];
  mealCount?: number;
  onChange: () => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-4">
        <h2 className="editorial-h2 text-3xl md:text-4xl flex items-baseline gap-3">
          식단 기록
          {mealCount != null && (
            <span className="text-base font-sans font-normal text-blue-500 tabular-nums">{mealCount}회</span>
          )}
        </h2>
        <p className="mt-3 font-serif italic text-muted-foreground text-sm">
          탄·단·지·채소·물을 직접 입력하면 즉시 피드백을 드려요.
        </p>
        {!creating && (
          <Button
            variant="outline"
            onClick={() => setCreating(true)}
            className="mt-6 rounded-none border-foreground hover:bg-foreground hover:text-background"
          >
            <Plus className="h-4 w-4 mr-2" />
            식사 기록 추가
          </Button>
        )}
      </div>

      <div className="col-span-12 md:col-span-8 space-y-6">
        {creating && (
          <MealForm
            date={date}
            mealsToday={meals.map(m => ({
              category: m.category,
              carbsG: m.carbsG,
              proteinG: m.proteinG,
              fatG: m.fatG,
              vegetableG: m.vegetableG,
              waterMl: m.waterMl,
            }))}
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              onChange();
            }}
          />
        )}

        {meals.length === 0 && !creating && (
          <div className="border hairline p-8 text-center font-serif italic text-muted-foreground">
            아직 오늘 기록한 식사가 없어요.
          </div>
        )}

        {meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function MealForm({
  date,
  mealsToday,
  onCancel,
  onCreated,
}: {
  date: string;
  mealsToday: Array<{
    category: MealCategory;
    carbsG: number; proteinG: number; fatG: number; vegetableG: number; waterMl: number;
  }>;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<MealCategory>("regular");
  const isSmoothie = category === "smoothie";
  const [description, setDescription] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [vegetableG, setVegetableG] = useState("");
  const [waterMl, setWaterMl] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const numbers = useMemo(() => ({
    carbsG: parseInt(carbsG) || 0,
    proteinG: parseInt(proteinG) || 0,
    fatG: parseInt(fatG) || 0,
    vegetableG: parseInt(vegetableG) || 0,
    waterMl: parseInt(waterMl) || 0,
  }), [carbsG, proteinG, fatG, vegetableG, waterMl]);

  const feedback = trpc.meals.feedback.useQuery(
    { ...numbers, mealsToday },
    { enabled: numbers.carbsG + numbers.proteinG + numbers.fatG + numbers.vegetableG + numbers.waterMl > 0 }
  );

  const create = trpc.meals.create.useMutation({
    onSuccess: () => {
      toast.success("식사가 기록되었습니다");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const maxAllowed = isSmoothie ? 8 : 4;
    const arr = Array.from(files).slice(0, maxAllowed - photos.length);
    const results: string[] = [];
    for (const f of arr) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error("이미지는 5MB 이하만 업로드 가능합니다");
        continue;
      }
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      results.push(b64);
    }
    setPhotos((prev) => [...prev, ...results]);
  };

  return (
    <div className="border hairline p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b hairline">
        <h3 className="editorial-h2 text-2xl">새 식사 기록</h3>
        <button onClick={onCancel}>
          <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Category toggle: 일반식 / 스무디 두 개 중 하나를 명확하게 선택 */}
      <div className="mb-5">
        <Label className="editorial-eyebrow text-muted-foreground mb-2 block">CATEGORY</Label>
        <div className="grid grid-cols-2 gap-3">
          {(["regular", "smoothie"] as const).map((v) => {
            const c = CATEGORIES.find(x => x.value === v)!;
            const active = category === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setCategory(v)}
                className={cn(
                  "border hairline px-4 py-3 text-left transition-colors",
                  active ? "bg-foreground text-background border-foreground" : "hover:bg-secondary/40"
                )}
              >
                <div className="editorial-eyebrow opacity-70">{c.caption}</div>
                <div className="font-serif text-lg mt-0.5">{c.label}</div>
              </button>
            );
          })}
        </div>
        {isSmoothie && (
          <p className="mt-2 font-serif italic text-xs text-muted-foreground">
            스무디는 사진만 올려도 인증이 됩니다. 사진 1장당 인증 1회로 자동 집계되어요.
          </p>
        )}
      </div>

      {!isSmoothie && (
        <>
          <div className="mb-5">
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">메모 (선택)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예) 현미밥, 닭가슴살 샐러드, 사과 한 알"
              className="rounded-none border-foreground/30 font-serif"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <NutrientInput label="탄수화물" suffix="g" value={carbsG} onChange={setCarbsG} />
            <NutrientInput label="단백질" suffix="g" value={proteinG} onChange={setProteinG} />
            <NutrientInput label="지방" suffix="g" value={fatG} onChange={setFatG} />
            <NutrientInput label="야채" suffix="g" value={vegetableG} onChange={setVegetableG} />
          </div>

          {/* Live feedback (물은 별도 섹션에서 입력하므로 waterMl=0으로 전송하여 잠재 피드백은 다른 끌니 종합에 사용) */}
          {feedback.data && feedback.data.length > 0 && (
            <div className="mb-5 space-y-2">
              {feedback.data.map((f: FeedbackItem, idx: number) => (
                <FeedbackPill key={idx} item={f} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Photos */}
      <div className="mb-5">
        <Label className="editorial-eyebrow text-muted-foreground mb-2 block">
          PHOTOS {isSmoothie ? "· 사진 1장 = 인증 1회" : "(최대 4장)"}
        </Label>
        <div className="flex flex-wrap gap-3">
          {photos.map((p, idx) => (
            <div key={idx} className="relative w-24 h-24 border hairline overflow-hidden">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < (isSmoothie ? 8 : 4) && (
            <label className="w-24 h-24 border-dashed border-2 border-foreground/20 hover:border-foreground/50 flex items-center justify-center cursor-pointer transition-colors">
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <Plus className="h-5 w-5 text-muted-foreground" />
            </label>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t hairline">
        <Button variant="ghost" onClick={onCancel} className="rounded-none">취소</Button>
        <Button
          onClick={async () => {
            if (isSmoothie) {
              if (photos.length === 0) {
                toast.error("스무디 사진을 1장 이상 첨부해 주세요");
                return;
              }
              // 스무디: 사진 N장 = 인증 N회 → 각 사진마다 meal 레코드 별도 생성
              try {
                for (const p of photos) {
                  await create.mutateAsync({
                    recordedDate: date,
                    category: "smoothie",
                    photoBase64: [p],
                  });
                }
              } catch (e) {
                // create.onError가 토스트 표시 처리
                return;
              }
              return;
            }
            // 일반식: 사진 필수 검사
            if (photos.length === 0) {
              toast.error("식단 사진을 1장 이상 첨부해 주세요");
              return;
            }
            create.mutate({
              recordedDate: date,
              category,
              description: description.trim() || undefined,
              ...numbers,
              photoBase64: photos,
            });
          }}
          disabled={create.isPending}
          className="rounded-none uppercase tracking-wider"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "인증하기"}
        </Button>
      </div>
    </div>
  );
}

function NutrientInput({ label, suffix, value, onChange }: { label: string; suffix: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="editorial-eyebrow text-muted-foreground mb-1 block">{label}</Label>
      <div className="flex items-baseline border-b border-foreground/30 focus-within:border-foreground transition-colors">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="rounded-none border-0 px-0 number-display text-2xl h-10 focus-visible:ring-0"
        />
        <span className="text-xs text-muted-foreground ml-1">{suffix}</span>
      </div>
    </div>
  );
}

function FeedbackPill({ item }: { item: FeedbackItem }) {
  const styles =
    item.tone === "warning"
      ? "border-l-2 border-destructive/60 bg-destructive/5"
      : item.tone === "praise"
      ? "border-l-2 border-accent bg-accent/5"
      : "border-l-2 border-foreground/30 bg-secondary/40";
  return (
    <div className={cn("py-2 px-3 font-serif text-sm leading-relaxed", styles)}>
      {item.text}
    </div>
  );
}

function MealCard({ meal, onChange }: { meal: MealRow; onChange: () => void }) {
  const cat = CATEGORIES.find(c => c.value === meal.category);
  const del = trpc.meals.delete.useMutation({
    onSuccess: () => { onChange(); toast.success("삭제되었습니다"); },
  });
  const regen = trpc.meals.regenerateAiComment.useMutation({
    onSuccess: () => { onChange(); toast.success("AI 코멘트가 갱신되었습니다"); },
    onError: () => toast.error("AI 코멘트 생성에 실패했습니다"),
  });

  return (
    <div className="border hairline p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="editorial-eyebrow text-muted-foreground">{cat?.caption}</div>
          <h3 className="editorial-h2 text-2xl mt-1">{cat?.label}</h3>
        </div>
        <button onClick={() => del.mutate({ id: meal.id })} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {meal.description && (
        <p className="font-serif italic text-foreground mb-4">{meal.description}</p>
      )}

      {meal.photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {meal.photos.map(p => (
            <img key={p.id} src={p.url} alt="" className="w-full aspect-square object-cover border hairline" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-2 mb-4 text-center">
        <NutrientStat label="탄" value={meal.carbsG} unit="g" />
        <NutrientStat label="단" value={meal.proteinG} unit="g" />
        <NutrientStat label="지" value={meal.fatG} unit="g" />
        <NutrientStat label="채" value={meal.vegetableG} unit="g" />
        <NutrientStat label="물" value={meal.waterMl} unit="ml" />
      </div>

      <div className="border-t hairline pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="editorial-eyebrow text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            AI COMMENT
          </div>
          <button
            onClick={() => regen.mutate({ mealId: meal.id })}
            disabled={regen.isPending}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {regen.isPending ? "생성 중…" : "다시 받기"}
          </button>
        </div>
        {meal.aiComment ? (
          <div className="font-serif text-sm leading-relaxed prose-sm">
            <Streamdown>{meal.aiComment}</Streamdown>
          </div>
        ) : (
          <div className="font-serif italic text-muted-foreground text-sm">
            잠시 후 AI 코멘트가 도착합니다…
          </div>
        )}
      </div>
    </div>
  );
}

function NutrientStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      <div className="editorial-eyebrow text-muted-foreground">{label}</div>
      <div className="number-display text-lg">{value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span></div>
    </div>
  );
}

/* ----------------- Exercise Section ----------------- */
type ExRow = {
  id: number;
  kind: string;
  durationMin: number;
  intensity: "low" | "medium" | "high";
  note: string | null;
};

const INTENSITY_OPTS = [
  { value: "low", label: "낮음" },
  { value: "medium", label: "보통" },
  { value: "high", label: "높음" },
] as const;

function ExerciseSection({ date, exercises, exerciseCount, onChange }: { date: string; exercises: ExRow[]; exerciseCount?: number; onChange: () => void }) {
  const [kind, setKind] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<"low" | "medium" | "high">("medium");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const exFileRef = useRef<HTMLInputElement>(null);

  const create = trpc.exercises.create.useMutation({
    onSuccess: () => {
      toast.success("운동이 기록되었습니다");
      setKind(""); setDuration(""); setNote(""); setIntensity("medium"); setPhoto(null);
      if (exFileRef.current) exFileRef.current.value = "";
      onChange();
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.exercises.delete.useMutation({
    onSuccess: () => { onChange(); toast.success("삭제되었습니다"); },
  });

  const handleExPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 업로드할 수 있어요."); return; }
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-4">
        <h2 className="editorial-h2 text-3xl md:text-4xl flex items-baseline gap-3">
          운동 기록
          {exerciseCount != null && (
            <span className="text-base font-sans font-normal text-blue-500 tabular-nums">{exerciseCount}회</span>
          )}
        </h2>
        <p className="mt-3 font-serif italic text-muted-foreground text-sm">
          작은 움직임도 기록하면 흐름이 됩니다.
        </p>
      </div>

      <div className="col-span-12 md:col-span-8">
        <div className="border hairline p-6 mb-6">
          <div className="grid grid-cols-12 gap-3 mb-4">
            <div className="col-span-12 md:col-span-6">
              <Label className="editorial-eyebrow text-muted-foreground mb-1 block">운동 종류</Label>
              <Input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                placeholder="예) 러닝, 요가, 필라테스"
                className="rounded-none border-0 border-b border-foreground/30 px-0 font-serif text-lg focus-visible:ring-0 focus-visible:border-foreground"
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <Label className="editorial-eyebrow text-muted-foreground mb-1 block">시간 (분)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                className="rounded-none border-0 border-b border-foreground/30 px-0 number-display text-lg focus-visible:ring-0 focus-visible:border-foreground"
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <Label className="editorial-eyebrow text-muted-foreground mb-1 block">강도</Label>
              <Select value={intensity} onValueChange={(v) => setIntensity(v as typeof intensity)}>
                <SelectTrigger className="rounded-none border-foreground/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTENSITY_OPTS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택)"
            className="rounded-none border-foreground/30 font-serif mb-4"
            rows={2}
          />

          {/* 운동 사진 — 필수 */}
          <div className="mb-4">
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">
              PHOTO · 운동 인증 사진 <span className="text-destructive">*필수</span>
            </Label>
            {photo ? (
              <div className="relative w-24 h-24 border hairline overflow-hidden">
                <img src={photo} alt="운동 사진" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhoto(null); if (exFileRef.current) exFileRef.current.value = ""; }}
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="w-24 h-24 border-dashed border-2 border-foreground/20 hover:border-foreground/50 flex flex-col items-center justify-center cursor-pointer transition-colors gap-1">
                <input
                  ref={exFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleExPhoto(e.target.files[0])}
                />
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">사진 추가</span>
              </label>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-serif italic">운동 현장 사진을 1장 올려주세요.</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (!kind.trim() || !duration) {
                  toast.error("운동 종류와 시간을 입력해 주세요");
                  return;
                }
                if (!photo) {
                  toast.error("운동 사진을 1장 이상 첨부해 주세요");
                  return;
                }
                create.mutate({
                  recordedDate: date,
                  kind: kind.trim(),
                  durationMin: parseInt(duration),
                  intensity,
                  note: note.trim() || undefined,
                  photoBase64: photo,
                });
              }}
              disabled={create.isPending}
              className="rounded-none uppercase tracking-wider"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "인증하기"}
            </Button>
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="border hairline p-8 text-center font-serif italic text-muted-foreground">
            아직 오늘 기록한 운동이 없어요.
          </div>
        ) : (
          <div className="space-y-2">
            {exercises.map(ex => (
              <div key={ex.id} className="border hairline p-4 flex items-center justify-between">
                <div>
                  <div className="font-serif text-lg">{ex.kind}</div>
                  <div className="text-sm text-muted-foreground">
                    {ex.durationMin}분 · 강도 {INTENSITY_OPTS.find(o => o.value === ex.intensity)?.label}
                  </div>
                  {ex.note && <div className="text-sm font-serif italic text-muted-foreground mt-1">{ex.note}</div>}
                </div>
                <button onClick={() => del.mutate({ id: ex.id })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ----------------- Sleep Section ----------------- */

type SleepStatus = "danger" | "warning" | "good" | "over" | "neutral";

function computeSleepMin(bH: number, bM: number, wH: number, wM: number): number {
  const bed = bH * 60 + bM;
  const wake = wH * 60 + wM;
  if (bed === wake) return 0;
  if (bed > wake) return 24 * 60 - bed + wake;
  return wake - bed;
}

function evaluateSleepClient(bH: number, bM: number, wH: number, wM: number): { durationMinutes: number; status: SleepStatus; message: string } {
  const dur = computeSleepMin(bH, bM, wH, wM);
  const pastMidnight = bH >= 0 && bH < 12;
  if (dur < 300 || pastMidnight) {
    return { durationMinutes: dur, status: "danger", message: "운동과 식단을 아무리 열심히 해도 수면이 부족하면 반쪽짜리에요" };
  }
  if (dur < 420) {
    return { durationMinutes: dur, status: "warning", message: "조금 더 자면 컨디션이 훨씬 좋아질 거예요" };
  }
  if (dur <= 510) {
    return { durationMinutes: dur, status: "good", message: "100점이에요" };
  }
  return { durationMinutes: dur, status: "over", message: "8시간 수면이 가장 이상적이에요" };
}

const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);
// 취침 시각 전용 휠: 18시부터 다음 날 새벽 6시까지 자연스럽게 이어지도록 정렬
// (저녁 → 밤 → 자정 → 새벽 흐름; 6 ~ 17시는 뒤쪽으로 밀어 회전 가능하게 유지)
const BED_HOUR_VALUES = [
  18, 19, 20, 21, 22, 23,
  0, 1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
];
const MINUTE_VALUES = Array.from({ length: 6 }, (_, i) => i * 10);

function WheelPicker({
  values,
  value,
  onChange,
  format,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;
  const idx = Math.max(0, values.indexOf(value));

  // Sync external value -> scroll position via effect (no render-time mutation)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = idx * itemHeight;
    if (Math.abs(el.scrollTop - target) > 2) {
      el.scrollTop = target;
    }
  }, [idx]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const newIdx = Math.round(el.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(values.length - 1, newIdx));
    const v = values[clamped];
    if (v !== value) {
      onChange(v);
    }
  };

  return (
    <div className="relative w-20 h-[120px] overflow-hidden border hairline bg-card/30">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ paddingTop: itemHeight, paddingBottom: itemHeight }}
      >
        {values.map((v) => (
          <div
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              "flex items-center justify-center snap-center cursor-pointer select-none number-display tabular-nums transition-colors",
              v === value ? "text-foreground text-xl" : "text-muted-foreground/60 text-base",
            )}
            style={{ height: itemHeight }}
          >
            {format(v)}
          </div>
        ))}
      </div>
      {/* center indicator lines */}
      <div className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 h-10 border-y border-foreground/40" />
    </div>
  );
}

function SleepSection({ date, sleepCount }: { date: string; sleepCount?: number }) {
  const utils = trpc.useUtils();
  const todaySleep = trpc.sleep.byDate.useQuery({ date });
  const sleepHistory = trpc.sleep.list.useQuery({ since: undefined } as any);

  const [bedHour, setBedHour] = useState<number>(23);
  const [bedMinute, setBedMinute] = useState<number>(0);
  const [wakeHour, setWakeHour] = useState<number>(7);
  const [wakeMinute, setWakeMinute] = useState<number>(0);

  // 기존 기록 있으면 최초 1회만 입력값을 동기화한다 (render-phase setState 회피)
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (!todaySleep.data) return;
    initRef.current = true;
    setBedHour(todaySleep.data.bedHour);
    setBedMinute(todaySleep.data.bedMinute);
    setWakeHour(todaySleep.data.wakeHour);
    setWakeMinute(todaySleep.data.wakeMinute);
  }, [todaySleep.data]);

  const evalResult = useMemo(
    () => evaluateSleepClient(bedHour, bedMinute, wakeHour, wakeMinute),
    [bedHour, bedMinute, wakeHour, wakeMinute],
  );

  const upsertSleep = trpc.sleep.upsert.useMutation({
    onSuccess: () => {
      utils.sleep.byDate.invalidate();
      utils.sleep.list.invalidate();
      utils.seasons.myProgress.invalidate();
      toast.success("수면이 기록되었습니다");
    },
  });

  const handleSave = () => {
    upsertSleep.mutate({
      recordedDate: date,
      bedHour,
      bedMinute,
      wakeHour,
      wakeMinute,
    });
  };

  const fmtH = (v: number) => v.toString().padStart(2, "0");
  const fmtM = (v: number) => v.toString().padStart(2, "0");
  const fmtBedH = (v: number) => {
    const padded = v.toString().padStart(2, "0");
    if (v >= 0 && v <= 5) return `${padded}새`; // 새벽
    return padded;
  };
  const hours = Math.floor(evalResult.durationMinutes / 60);
  const mins = evalResult.durationMinutes % 60;

  // Recent 7 days history mini chart bars
  const recent = (sleepHistory.data ?? []).slice(-7);

  return (
    <section className="py-10 border-b hairline">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="editorial-eyebrow text-muted-foreground mb-2">02 · SLEEP</div>
          <h2 className="editorial-h2 text-3xl md:text-4xl flex items-baseline gap-3">
            수면 기록
            {sleepCount != null && (
              <span className="text-base font-sans font-normal text-blue-500 tabular-nums">{sleepCount}회</span>
            )}
          </h2>
          <p className="mt-3 font-serif italic text-muted-foreground text-sm">
            운동·식단만큼 중요한 수면. 취침과 기상 시간을 선택하면 자동으로 계산되어요.
          </p>
        </div>
        <div className="col-span-12 md:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 취침 */}
            <div>
              <div className="editorial-eyebrow text-muted-foreground mb-2">취침</div>
              <div className="flex items-center gap-2">
                <WheelPicker values={BED_HOUR_VALUES} value={bedHour} onChange={setBedHour} format={fmtBedH} />
                <span className="font-serif text-2xl text-muted-foreground">:</span>
                <WheelPicker values={MINUTE_VALUES} value={bedMinute} onChange={setBedMinute} format={fmtM} />
              </div>
            </div>
            {/* 기상 */}
            <div>
              <div className="editorial-eyebrow text-muted-foreground mb-2">기상</div>
              <div className="flex items-center gap-2">
                <WheelPicker values={HOUR_VALUES} value={wakeHour} onChange={setWakeHour} format={fmtH} />
                <span className="font-serif text-2xl text-muted-foreground">:</span>
                <WheelPicker values={MINUTE_VALUES} value={wakeMinute} onChange={setWakeMinute} format={fmtM} />
              </div>
            </div>
          </div>

          {/* Result */}
          <div className={cn(
            "border hairline px-4 py-4 flex flex-wrap items-center gap-x-6 gap-y-2",
            evalResult.status === "danger" && "bg-rose-50/70 border-rose-200",
          )}>
            <div>
              <div className="editorial-eyebrow text-muted-foreground">수면 시간</div>
              <div className="number-display tabular-nums text-2xl">
                {hours}<span className="text-base text-muted-foreground ml-0.5">h</span> {mins}<span className="text-base text-muted-foreground ml-0.5">m</span>
              </div>
            </div>
            {evalResult.message && (
              <p className={cn(
                "font-serif italic text-sm md:text-base flex-1 min-w-[220px]",
                evalResult.status === "danger" ? "text-rose-900"
                : evalResult.status === "warning" ? "text-amber-700"
                : evalResult.status === "good" ? "text-emerald-700"
                : evalResult.status === "over" ? "text-purple-700"
                : "text-foreground",
              )}>
                {evalResult.message}
              </p>
            )}
            <div className="ml-auto">
              <Button
                onClick={handleSave}
                disabled={upsertSleep.isPending}
                className="rounded-none px-6 h-10 uppercase tracking-wider"
              >
                {upsertSleep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : todaySleep.data ? "수정" : "저장"}
              </Button>
            </div>
          </div>

          {/* Mini 7-day trend */}
          {recent.length > 0 && (
            <div>
              <div className="editorial-eyebrow text-muted-foreground mb-2">최근 7일 추이</div>
              <div className="flex items-end gap-1 h-20">
                {recent.map((s) => {
                  const dur = s.durationMinutes;
                  const h = Math.max(2, Math.min(80, (dur / 600) * 80));
                  const color =
                    dur < 300
                      ? "bg-rose-400"
                      : dur < 420
                      ? "bg-amber-400"
                      : dur <= 510
                      ? "bg-emerald-500"
                      : "bg-purple-400";
                  return (
                    <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                      <div className={cn("w-full", color)} style={{ height: h }} />
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {s.recordedDate.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground flex gap-4">
                <span><span className="inline-block w-2 h-2 bg-rose-400 mr-1" />5h 미만</span>
                <span><span className="inline-block w-2 h-2 bg-amber-400 mr-1" />5–7h</span>
                <span><span className="inline-block w-2 h-2 bg-emerald-500 mr-1" />7–8.5h</span>
                <span><span className="inline-block w-2 h-2 bg-purple-400 mr-1" />8.5h+</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------- Season Photos Section ----------------- */
function SeasonPhotosSection() {
  const utils = trpc.useUtils();
  const myPhotos = trpc.seasons.myPhotos.useQuery();
  const myProgress = trpc.seasons.myProgress.useQuery();

  const upload = trpc.seasons.uploadPhoto.useMutation({
    onSuccess: () => {
      utils.seasons.myPhotos.invalidate();
      toast.success("사진이 업로드되었어요");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.seasons.deletePhoto.useMutation({
    onSuccess: () => {
      utils.seasons.myPhotos.invalidate();
      toast.success("사진을 삭제했어요");
    },
  });

  const day = myProgress.data?.dayNumber ?? null;
  const total = myProgress.data?.totalDays ?? 13;
  const isDay1 = day === 1;
  const isLastDay = day !== null && day === total;
  const season = myPhotos.data?.season ?? myProgress.data?.season ?? null;

  if (!season) {
    // 시즌이 없으면 섹션 숨김
    return null;
  }

  const photos = myPhotos.data?.photos ?? [];
  const beforePhotos = photos.filter(p => p.slot === "before");
  const progressPhotos = photos.filter(p => p.slot === "progress");
  const afterPhotos = photos.filter(p => p.slot === "after");

  const findOne = (slot: "before" | "after", angle: "front" | "side") =>
    photos.find(p => p.slot === slot && p.angle === angle);

  const handleFile = async (
    file: File,
    slot: "before" | "progress" | "after",
    angle: "front" | "side",
  ) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB 이하 이미지만 업로드할 수 있어요.");
      return;
    }
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    upload.mutate({ slot, angle, photoBase64: b64 });
  };

  return (
    <section className="py-10 border-b hairline">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="editorial-eyebrow text-muted-foreground mb-2">02 · TRANSFORMATION</div>
          <h2 className="editorial-h2 text-3xl md:text-4xl">비포 / 애프터</h2>
          <p className="mt-3 font-serif italic text-muted-foreground text-sm leading-relaxed">
            챌린지 시작과 끝에 같은 자세로 촬영해 주세요.
            <br />
            <span className="text-foreground">가급적 전신이 다 나오도록 촬영해 주세요.</span>
            <br />매일의 진행 사진은 선택입니다.
          </p>
          <div className="mt-4 text-xs text-muted-foreground">
            BEFORE는 1일차에만, AFTER는 마지막 날(Day {total})에만 등록할 수 있어요.
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 space-y-8">
          {/* BEFORE */}
          <PhotoSlotBlock
            label="BEFORE"
            sublabel={isDay1 ? "오늘이 1일차예요. 전면/측면 두 장을 모두 올려 주세요." : "Day 1에만 등록할 수 있어요."}
            disabled={!isDay1}
            front={findOne("before", "front")}
            side={findOne("before", "side")}
            onPick={(angle, file) => handleFile(file, "before", angle)}
            onDelete={(id) => del.mutate({ id })}
            uploading={upload.isPending}
            forceShow={beforePhotos.length > 0 || isDay1}
          />

          {/* PROGRESS — every day */}
          <ProgressBlock
            photos={progressPhotos}
            onPick={(angle, file) => handleFile(file, "progress", angle)}
            onDelete={(id) => del.mutate({ id })}
            uploading={upload.isPending}
            disabled={!day}
          />

          {/* AFTER */}
          <PhotoSlotBlock
            label="AFTER"
            sublabel={isLastDay ? "오늘이 마지막 날이에요. 전면/측면 두 장을 모두 올려 주세요." : `Day ${total}에만 등록할 수 있어요.`}
            disabled={!isLastDay}
            front={findOne("after", "front")}
            side={findOne("after", "side")}
            onPick={(angle, file) => handleFile(file, "after", angle)}
            onDelete={(id) => del.mutate({ id })}
            uploading={upload.isPending}
            forceShow={afterPhotos.length > 0 || isLastDay}
          />
        </div>
      </div>
    </section>
  );
}

function PhotoSlotBlock({
  label,
  sublabel,
  disabled,
  front,
  side,
  onPick,
  onDelete,
  uploading,
  forceShow,
}: {
  label: "BEFORE" | "AFTER";
  sublabel: string;
  disabled: boolean;
  front?: { id: number; photoUrl: string; dayNumber: number };
  side?: { id: number; photoUrl: string; dayNumber: number };
  onPick: (angle: "front" | "side", file: File) => void;
  onDelete: (id: number) => void;
  uploading: boolean;
  forceShow: boolean;
}) {
  if (!forceShow) return null;
  return (
    <div className={cn("border hairline p-5", disabled && "opacity-70")}>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="editorial-eyebrow text-muted-foreground">{label}</div>
          <div className="text-sm text-muted-foreground mt-1">{sublabel}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PhotoPicker
          label="FRONT"
          ko="전면"
          photo={front}
          disabled={disabled}
          uploading={uploading}
          onPick={(f) => onPick("front", f)}
          onDelete={onDelete}
        />
        <PhotoPicker
          label="SIDE"
          ko="측면"
          photo={side}
          disabled={disabled}
          uploading={uploading}
          onPick={(f) => onPick("side", f)}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function ProgressBlock({
  photos,
  onPick,
  onDelete,
  uploading,
  disabled,
}: {
  photos: Array<{ id: number; photoUrl: string; dayNumber: number; angle: "front" | "side" }>;
  onPick: (angle: "front" | "side", file: File) => void;
  onDelete: (id: number) => void;
  uploading: boolean;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [angle, setAngle] = useState<"front" | "side">("front");
  return (
    <div className={cn("border hairline p-5", disabled && "opacity-70")}>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="editorial-eyebrow text-muted-foreground">PROGRESS · 매일</div>
          <div className="text-sm text-muted-foreground mt-1">
            오늘의 진행 사진을 선택적으로 올릴 수 있어요. (각도 선택 후 사진 추가)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={angle} onValueChange={(v) => setAngle(v as "front" | "side")}>
            <SelectTrigger className="rounded-none border-foreground/30 w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="front">전면 (FRONT)</SelectItem>
              <SelectItem value="side">측면 (SIDE)</SelectItem>
            </SelectContent>
          </Select>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(angle, f);
              if (ref.current) ref.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => ref.current?.click()}
            className="rounded-none uppercase tracking-wider"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4 mr-2" />사진 추가</>}
          </Button>
        </div>
      </div>
      {photos.length === 0 ? (
        <div className="text-sm font-serif italic text-muted-foreground">
          아직 진행 사진이 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {photos
            .slice()
            .sort((a, b) => b.dayNumber - a.dayNumber)
            .map(p => (
              <div key={p.id} className="relative group border hairline aspect-square overflow-hidden">
                <img src={p.photoUrl} alt="진행 사진" className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1 bg-foreground/80 text-background text-[10px] tracking-wider px-1.5 py-0.5">
                  D{p.dayNumber} · {p.angle === "front" ? "F" : "S"}
                </div>
                <button
                  onClick={() => onDelete(p.id)}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive hover:text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function PhotoPicker({
  label,
  ko,
  photo,
  disabled,
  uploading,
  onPick,
  onDelete,
}: {
  label: string;
  ko: string;
  photo?: { id: number; photoUrl: string; dayNumber: number };
  disabled: boolean;
  uploading: boolean;
  onPick: (file: File) => void;
  onDelete: (id: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="editorial-eyebrow text-muted-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{ko}</div>
      </div>
      {photo ? (
        <div className="relative aspect-[3/4] border hairline overflow-hidden bg-secondary/30">
          <img src={photo.photoUrl} alt={ko} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2 bg-foreground/80 text-background text-[10px] tracking-wider px-1.5 py-0.5">
            DAY {photo.dayNumber}
          </div>
          {!disabled && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => ref.current?.click()}
                className="rounded-none h-7 text-xs bg-background/80"
              >
                교체
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => onDelete(photo.id)}
                className="rounded-none h-7 text-xs bg-background/80"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => ref.current?.click()}
          className={cn(
            "aspect-[3/4] w-full border hairline border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors",
            !disabled && "hover:bg-secondary/40 hover:text-foreground cursor-pointer",
            disabled && "cursor-not-allowed",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Camera className="h-6 w-6" />
              <span className="editorial-eyebrow text-xs">사진 추가</span>
            </>
          )}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (ref.current) ref.current.value = "";
        }}
      />
    </div>
  );
}

/* ----------------- Water Section ----------------- */

const WATER_VOLUME_OPTIONS = [300, 400, 500, 600, 700, 800, 900, 1000] as const;
const WATER_DAILY_TARGET_ML = 2000;

function WaterSection({ date, waterCount }: { date: string; waterCount?: number }) {
  const utils = trpc.useUtils();
  const watersToday = trpc.waters.byDate.useQuery({ date });
  const [volumeMl, setVolumeMl] = useState<number>(500);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalMl = watersToday.data?.totalMl ?? 0;
  const items = watersToday.data?.items ?? [];
  const progressPct = Math.min(100, Math.round((totalMl / WATER_DAILY_TARGET_ML) * 100));

  const create = trpc.waters.multiCreate.useMutation({
    onSuccess: (res) => {
      utils.waters.byDate.invalidate();
      utils.seasons.myProgress.invalidate();
      toast.success(`물 ${res.count}회 기록되었습니다 (${(volumeMl * res.count).toLocaleString()}ml)`);
      setPhotos([]);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.waters.delete.useMutation({
    onSuccess: () => {
      utils.waters.byDate.invalidate();
      toast.success("삭제되었습니다");
    },
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 8 - photos.length);
    const results: string[] = [];
    for (const f of arr) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error("이미지는 5MB 이하만 업로드 가능합니다");
        continue;
      }
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      results.push(b64);
    }
    setPhotos((prev) => [...prev, ...results]);
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-4">
        <h2 className="editorial-h2 text-3xl md:text-4xl flex items-baseline gap-3">
          물 기록
          {((waterCount ?? items.length) > 0) && (
            <span className="text-base font-sans font-normal text-blue-500 tabular-nums">{waterCount ?? items.length}회</span>
          )}
        </h2>
        <p className="mt-3 font-serif italic text-muted-foreground text-sm">
          한 잔씩 사진으로 남겨 주세요. 사진 1장 = 기록 1회로 누적됩니다.
        </p>

        {/* 누적 진행 바 */}
        <div className="mt-6 border hairline p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="editorial-eyebrow text-muted-foreground">오늘 누적</span>
            <span className="number-display text-2xl tabular-nums">
              {totalMl.toLocaleString()}
              <span className="text-xs text-muted-foreground ml-1">ml</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-secondary/60 overflow-hidden">
            <div
              className={cn(
                "h-full transition-[width] duration-500 ease-out",
                totalMl >= WATER_DAILY_TARGET_ML ? "bg-emerald-500" : "bg-foreground"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-serif italic text-muted-foreground">
              {totalMl >= WATER_DAILY_TARGET_ML
                ? "오늘 수분 목표 달성!"
                : `목표 ${WATER_DAILY_TARGET_ML.toLocaleString()}ml까지 ${(WATER_DAILY_TARGET_ML - totalMl).toLocaleString()}ml`}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{progressPct}%</span>
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-8 space-y-6">
        {/* 입력 카드 */}
        <div className="border hairline p-6">
          <div className="mb-4">
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">
              VOLUME · 한 잔당 용량
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {WATER_VOLUME_OPTIONS.map((v) => {
                const active = volumeMl === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVolumeMl(v)}
                    className={cn(
                      "border hairline px-3 py-2 transition-colors number-display tabular-nums text-base",
                      active ? "bg-foreground text-background border-foreground" : "hover:bg-secondary/40",
                    )}
                  >
                    {v}
                    <span className="text-xs ml-1 opacity-70">ml</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">
              PHOTOS · 사진 1장 = 인증 1회 (최대 8장)
            </Label>
            <div className="flex flex-wrap gap-3">
              {photos.map((p, idx) => (
                <div key={idx} className="relative w-24 h-24 border hairline overflow-hidden">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 8 && (
                <label className="w-24 h-24 border-dashed border-2 border-foreground/20 hover:border-foreground/50 flex items-center justify-center cursor-pointer transition-colors">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </label>
              )}
            </div>
            {photos.length > 0 && (
              <p className="mt-2 font-serif italic text-xs text-muted-foreground">
                선택된 사진 {photos.length}장 × {volumeMl}ml = 저장 시{" "}
                <span className="text-foreground number-display">
                  {(photos.length * volumeMl).toLocaleString()}ml
                </span>{" "}
                추가, 인증 {photos.length}회로 집계됩니다.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t hairline">
            <Button
              onClick={() => {
                if (photos.length === 0) {
                  toast.error("물 사진을 1장 이상 첨부해 주세요");
                  return;
                }
                create.mutate({
                  recordedDate: date,
                  volumeMl,
                  photoBase64: photos,
                });
              }}
              disabled={create.isPending}
              className="rounded-none uppercase tracking-wider"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "인증하기"}
            </Button>
          </div>
        </div>

        {/* 오늘 인증 리스트 */}
        {items.length === 0 ? (
          <div className="border hairline p-8 text-center font-serif italic text-muted-foreground">
            아직 오늘 물 기록이 없어요.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((it) => (
              <div key={it.id} className="border hairline overflow-hidden bg-background">
                <div className="aspect-square bg-secondary/30 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.photoUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="editorial-eyebrow text-muted-foreground">VOLUME</div>
                    <div className="number-display tabular-nums text-lg">
                      {it.volumeMl}
                      <span className="text-xs text-muted-foreground ml-0.5">ml</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => del.mutate({ id: it.id })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
