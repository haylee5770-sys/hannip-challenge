import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
import { PRODUCTS, PRODUCT_ROWS, DAILY_TARGET } from "@/lib/products";
import { quoteOf } from "@/lib/quotes";
import { shareProof, type ProofCard } from "@/lib/proofCard";
import { loadDecor } from "@/lib/decor";
import { Streamdown } from "streamdown";
import { shareKakao, isKakaoReady } from "@/lib/kakao";

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
  const [date, setDate] = useState<string>(() => todayLocal());
  const sleepToday = trpc.sleep.byDate.useQuery({ date });
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const userName = user?.name ?? "";
  // 자랑하기: 저장 후 인증 카드 이미지를 만들어 공유창(카톡)으로 (2026-11-20)
  const [bragCard, setBragCard] = useState<ProofCard | null>(null);
  const myCounts = trpc.rounds.myCounts.useQuery();
  const kakaoShareText: string | null = null;
  /** 새 자랑하기: 이번 회차 안 항목별 번호 + 내 사진 + 피드백 (2026-11-20) */
  const bragItem: BragFn = async (p) => {
    let n: number | undefined;
    // 2026-11-21: 식단은 일반식+스무디를 합친 누적 번호 (금 6회 → 토 첫 인증 7)
    try {
      await utils.rounds.myCounts.invalidate();
      const r = await utils.rounds.myCounts.fetch();
      const c = r.counts as any;
      n = p.item === "meal" || p.item === "smoothie" ? (c.meal ?? 0) + (c.smoothie ?? 0) : c[p.item];
    } catch {}
    const time = new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
    const card: ProofCard = { emoji: p.emoji, title: p.label, lines: [], userName, date, count: n, photo: p.photo, itemLabel: p.label, feedback: p.feedback, time, avatar: (user as any)?.avatarUrl ?? null };
    utils.happy.yearProgress.invalidate();
    shareProof(card)
      .then(r => {
        if (r === "downloaded") toast.success("인증 사진을 저장하고 문구를 복사했어요.");
        if (r === "blocked") setBragCard(card);
      })
      .catch(() => setBragCard(card));
  };
  const setKakaoShareText = (text: string | null) => {
    if (!text) return;
    const parts = text.replace(/#super_hannip_challenge/g, "").split("\n").map(s => s.trim()).filter(Boolean);
    const first = parts[0] ?? "";
    const m = first.match(/^(\S+)\s+(.*?)(?:\s*완료!?)?$/);
    const card: ProofCard = {
      emoji: m?.[1] ?? "💚",
      title: (m?.[2] ?? first).replace(/인증$/, "").trim() + " 인증",
      lines: parts.slice(1),
      userName,
      date,
    };
    shareProof(card)
      .then(r => {
        if (r === "downloaded") toast.success("인증 사진을 저장하고 문구를 복사했어요. 카톡에 사진과 함께 붙여 넣어 주세요.");
        if (r === "blocked") setBragCard(card);
      })
      .catch(() => setBragCard(card));
  };

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
      const kg = parseFloat(weightKg);
      const txt = `🏋️ ${userName || "오늘"} 체중 ${Number.isFinite(kg) ? kg.toFixed(1) + "kg" : ""} 인증 완료!\n#super_hannip_challenge`;
      setKakaoShareText(txt.trim());
    },
  });

  const analyzeInbody = trpc.weights.analyzeInbody.useMutation();

  // Goal
  const goal = trpc.goals.mine.useQuery();

  // Meals today
  const myMealsToday = trpc.meals.byMeDate.useQuery({ date });
  const myExercisesToday = trpc.exercises.byMeDate.useQuery({ date });
  // '어제' 체크 자동: 전날 식단·운동 기록
  const mealsPrevDay = trpc.meals.byMeDate.useQuery({ date: shiftDate(date, -1) });
  const exercisesPrevDay = trpc.exercises.byMeDate.useQuery({ date: shiftDate(date, -1) });

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
      {/* 카카오 공유 배너 */}
      {bragCard && (
        <div className="fixed bottom-4 inset-x-4 z-50 rounded-2xl bg-card border border-primary p-4 shadow-xl flex items-center gap-3">
          <span className="text-sm flex-1">저장됐어요! 버튼을 누르면 인증 사진이 카톡으로 가요.</span>
          <Button className="rounded-full" onClick={() => { const c = bragCard; setBragCard(null); shareProof(c); }}>카톡으로 자랑하기</Button>
          <button type="button" onClick={() => setBragCard(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* 우리 방 모토 한 줄 (주간 안내 대신, 2026-11-20) */}

      {/* Season banner */}
      {seasonProgress.data?.season && (
        <section className="mb-4 rounded-2xl bg-card border border-border px-5 py-4 md:px-6">
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

      {/* 우리 방 모토 — 오늘 칸 위, 가운데 */}
      <p className="text-center text-sm md:text-base text-primary mb-3">꾸준함이 자존감이 되고, 자존감이 인생을 바꾼다</p>

      {/* 날짜 앞뒤로 보기 (팀보드처럼) */}
      <div className="flex items-center justify-between rounded-2xl bg-card border border-border px-3 py-2 mb-4">
        <button type="button" onClick={() => setDate(shiftDate(date, -1))} className="px-3 py-2 text-xl text-muted-foreground hover:text-primary" aria-label="이전 날">‹</button>
        <div className="text-center">
          <div className="text-lg md:text-xl font-semibold tabular-nums">
            {date === todayLocal() && <span className="text-primary mr-1.5">오늘</span>}
            {formatShortDate(date)}
          </div>
          {date !== todayLocal() && (
            <button type="button" onClick={() => setDate(todayLocal())} className="text-[11px] text-muted-foreground underline">오늘로</button>
          )}
          <DailyLines date={date} />
        </div>
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= todayLocal()}
          className="px-3 py-2 text-xl text-muted-foreground hover:text-primary disabled:opacity-20"
          aria-label="다음 날"
        >›</button>
      </div>
      {date < todayLocal() && user?.role !== "admin" && (
        <p className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
          🔒 밤 12시가 지난 날짜는 보기만 할 수 있어요. 기록·수정·삭제는 그날 안에만 돼요.
        </p>
      )}

      {/* 따·잠·마·음·운 매일 체크 */}
      <DailyChecklist
        date={date}
        autoSlept={!!sleepToday.data}
        autoCleanEat={(mealsPrevDay.data?.length ?? 0) > 0}
        autoExercised={(exercisesPrevDay.data?.length ?? 0) > 0}
      />
      {/* Sleep — 수면 기록 */}
      <SleepSection date={date} sleepCount={seasonProgress.data?.counts.sleep} onBrag={bragItem} />


      {/* Meals — 식단 기록 (독립 섹션) */}
      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <MealsSection
          date={date}
          meals={myMealsToday.data ?? []}
          mealCount={myCounts.data ? myCounts.data.counts.meal + myCounts.data.counts.smoothie : undefined}
          userName={userName}
          onChange={() => {
            utils.rounds.myCounts.invalidate(); utils.wellness.intake.invalidate();
            utils.meals.byMeDate.invalidate();
            utils.feed.today.invalidate();
            utils.seasons.myProgress.invalidate();
          }}
          onBrag={bragItem}
        />
      </section>

      {/* Water — 물 기록 (사진 + 용량, 독립 섹션) */}
      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <WaterSection date={date} waterCount={myCounts.data?.counts.water} userName={userName} onBrag={bragItem} />
      </section>

      {/* Exercise — 운동 기록 */}
      <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <ExerciseSection
          date={date}
          exercises={myExercisesToday.data ?? []}
          exerciseCount={myCounts.data?.counts.exercise}
          userName={userName}
          onChange={() => {
            utils.rounds.myCounts.invalidate(); utils.wellness.intake.invalidate();
            utils.exercises.byMeDate.invalidate();
            utils.feed.today.invalidate();
            utils.seasons.myProgress.invalidate();
          }}
          onBrag={bragItem}
        />
      </section>
      {/* 체중 — 한 달에 한 번 (2026-11-21 새로: 체중계 종류 선택 없이 큰 버튼 → 사진 올리면 AI가 읽고, 골격근 kg · 체지방률 %로 통일) */}
      <section id="weight" className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
        <WeightSection date={date} userName={userName} onBrag={bragItem} />
      </section>

      {/* Season photos (Before / After) — 맨 아래 */}
      <SeasonPhotosSection />
    </div>
  );
}

/* ----------------- Weight Section (2026-11-21) ----------------- */
function WeightSection({ date, userName, onBrag }: { date: string; userName?: string; onBrag?: BragFn }) {
  const utils = trpc.useUtils();
  const history = trpc.weights.myHistory.useQuery({});
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [w, setW] = useState("");
  const [smm, setSmm] = useState("");
  const [bf, setBf] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyze = trpc.wellness.analyzeScale.useMutation();
  const save = trpc.weights.upsert.useMutation({ onError: (e) => toast.error(e.message) });
  const list = (history.data ?? []).slice().sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const prev = list.filter(x => x.recordedDate < date).slice(-1)[0];

  const onFile = (file: File) => {
    const r = new FileReader();
    r.onload = async () => {
      // 글자를 잘 읽도록 긴 변 1600px로 맞춤
      const raw = r.result as string;
      const img = new Image(); img.src = raw; await new Promise(res => { img.onload = res; img.onerror = res; });
      const k = 1600 / Math.max(img.naturalWidth || 1600, img.naturalHeight || 1600);
      const c = document.createElement("canvas"); c.width = Math.round((img.naturalWidth || 1600) * k); c.height = Math.round((img.naturalHeight || 1600) * k);
      const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const data = img.naturalWidth ? c.toDataURL("image/jpeg", 0.92) : raw;
      setPhoto(data); setNotes([]);
      try {
        const a = await analyze.mutateAsync({ photoBase64: data });
        if (a.weightKg) setW(String(a.weightKg)); if (a.skeletalMuscleKg) setSmm(String(a.skeletalMuscleKg)); if (a.bodyFatPercent) setBf(String(a.bodyFatPercent));
        setNotes(a.notes);
        toast.success("사진에서 숫자를 읽었어요. 맞는지 확인해 주세요.");
      } catch { toast.error("자동으로 읽지 못했어요. 직접 입력해 주세요."); }
    };
    r.readAsDataURL(file);
  };
  const submit = async () => {
    const kg = parseFloat(w);
    if (!photo) return toast.error("체중계 사진을 올려 주세요. 사진 인증이 필수예요.");
    if (!Number.isFinite(kg)) return toast.error("체중을 입력해 주세요.");
    const s = parseFloat(smm), b = parseFloat(bf);
    try {
      await save.mutateAsync({ recordedDate: date, weightKg: kg, skeletalMuscleKg: Number.isFinite(s) ? s : null, bodyFatPercent: Number.isFinite(b) ? b : null, inbodyPhotoBase64: photo });
    } catch { return; }
    utils.weights.myHistory.invalidate(); utils.wellness.weighIn.invalidate(); utils.wellness.intake.invalidate(); utils.rounds.myCounts.invalidate();
    const diff = prev ? Math.round((kg - prev.weightKg) * 10) / 10 : null;
    onBrag?.({
      item: "weight", label: "체중", emoji: "⚖️", photo,
      feedback: [`${kg}kg`, Number.isFinite(s) ? `골격근 ${s}kg` : null, Number.isFinite(b) ? `체지방률 ${b}%` : null, diff != null ? `지난번보다 ${diff > 0 ? "+" : ""}${diff}kg` : null].filter(Boolean).join(" · "),
    });
    setOpen(false); setPhoto(null); setW(""); setSmm(""); setBf(""); setNotes([]);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg md:text-xl font-semibold">{userName ? `${userName} 한 달 체중` : "한 달 체중"}</h2>
      <p className="text-xs text-muted-foreground">체중은 한 달에 한 번, <b className="text-foreground">매달 1일</b> 아침 공복에 재요.</p>
      {!open && (
        <Button onClick={() => setOpen(true)} className="w-full rounded-xl h-11">
          <Plus className="h-4 w-4 mr-2" /> 체중 기록 추가
        </Button>
      )}
      {open && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm">사진을 올리면 <b className="text-primary">AI가 체중·골격근량·체지방률을 자동으로 읽어요.</b></p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            기기마다 단위가 달라도 <b className="text-foreground">골격근량은 kg, 체지방률은 %</b>로 맞춰 저장해요. 그래야 대시보드에서 오르내림을 비교할 수 있어요.
            일반 체중계는 체중만 읽혀요. AI 인식은 오류가 있을 수 있으니 숫자를 꼭 확인하고, 직접 고쳐도 돼요.
          </p>
          <div className="flex items-center gap-3">
            {photo ? <img src={photo} alt="" className="w-20 h-20 rounded-lg object-cover border border-border" /> : null}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={analyze.isPending} className="rounded-xl">
              {analyze.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />AI가 읽는 중</> : <><Camera className="h-4 w-4 mr-2" />{photo ? "다른 사진" : "사진 올리기"}</>}
            </Button>
          </div>
          {notes.length > 0 && <div className="space-y-1">{notes.map((n, i) => <p key={i} className="text-[11px] text-amber-200">ⓘ {n}</p>)}</div>}
          <div className="grid grid-cols-3 gap-2">
            {([["체중 (kg)*", w, setW], ["골격근량 (kg)", smm, setSmm], ["체지방률 (%)", bf, setBf]] as const).map(([label, v, set]) => (
              <label key={label} className="text-[11px] text-muted-foreground">{label}
                <input inputMode="decimal" value={v} onChange={e => set(e.target.value)} placeholder="-" className="mt-0.5 w-full h-11 rounded-lg border border-border bg-transparent px-2 text-lg font-semibold text-foreground" />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); setPhoto(null); setNotes([]); }} className="flex-1 rounded-xl">취소</Button>
            <Button onClick={submit} disabled={save.isPending} className="flex-1 rounded-xl">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "자랑하기"}</Button>
          </div>
        </div>
      )}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {list.slice(-6).map(x => (
            <span key={x.id} className="px-2 py-1 rounded-lg bg-background/50 border border-border">
              {x.recordedDate.slice(2).replace(/-/g, ".")} <b className="text-primary">{x.weightKg}kg</b>
              {x.skeletalMuscleKg != null ? ` · 골격근 ${x.skeletalMuscleKg}` : ""}{x.bodyFatPercent != null ? ` · 체지방 ${x.bodyFatPercent}%` : ""}
            </span>
          ))}
        </div>
      )}
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
  userName,
  onChange,
  onBrag,
}: {
  date: string;
  meals: MealRow[];
  mealCount?: number;
  userName?: string;
  onChange: () => void;
  onBrag?: BragFn;
}) {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const opened = meals.find(m => m.id === openId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg md:text-xl font-semibold">{userName ? `${userName} 식단 기록` : "식단 기록"}</h2>
      </div>
      {!creating && (
        <Button onClick={() => setCreating(true)} className="w-full rounded-xl h-11">
          <Plus className="h-4 w-4 mr-2" /> 식사 기록 추가
        </Button>
      )}
      {creating && (
        <MealForm
          date={date}
          mealsToday={meals.map(m => ({ category: m.category, carbsG: m.carbsG, proteinG: m.proteinG, fatG: m.fatG, vegetableG: m.vegetableG, waterMl: m.waterMl }))}
          onCancel={() => setCreating(false)}
          onCreated={(b) => { setCreating(false); onChange(); if (b) onBrag?.(b); }}
        />
      )}
      {/* 오늘 기록: 메달 (누르면 자세히 · 코멘트 · 삭제) */}
      <Medals
        items={meals.slice().sort((a, b) => a.id - b.id).map((m, i) => ({ id: m.id, label: `${i + 1}회`, sub: m.category === "smoothie" ? "스무디" : "일반식" }))}
        onOpen={setOpenId}
        total={mealCount}
      />
      <DailyNutritionTotals meals={meals} date={date} />
      <Popup open={!!opened} onClose={() => setOpenId(null)}>
        {opened && <MealCard meal={opened} onChange={() => { onChange(); setOpenId(null); }} />}
      </Popup>
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
  onCreated: (brag?: { item: BragItem; label: string; emoji: string; photo?: string; feedback: string }) => void;
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
  // 스무디·퓨레 버튼으로 고른 개수 (id → 개수)
  const [picked, setPicked] = useState<Record<string, number>>({});
  const pickedList = PRODUCTS.flatMap(p => Array.from({ length: picked[p.id] ?? 0 }, () => p));
  const analyze = trpc.meals.analyzePhoto.useMutation({
    onSuccess: (r) => {
      if (r.foods) setDescription(r.foods);
      setCarbsG(String(r.carbsG)); setProteinG(String(r.proteinG)); setFatG(String(r.fatG)); setVegetableG(String(r.vegetableG));
      toast.success("AI가 사진을 분석했어요. 숫자는 고칠 수 있어요.");
    },
    onError: (e) => toast.error(e.message || "분석에 실패했어요. 숫자를 직접 넣어 주세요."),
  });

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
    onSuccess: () => { toast.success("식사가 기록되었습니다"); },
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
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b hairline">
        <h3 className="text-base font-semibold">새 식사 기록</h3>
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
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  active ? "bg-foreground text-background border-foreground" : "hover:bg-secondary/40"
                )}
              >
                <div className="editorial-eyebrow opacity-70">{c.caption}</div>
                <div className="text-sm font-semibold">{c.label}</div>
              </button>
            );
          })}
        </div>
        {isSmoothie && (
          <p className="mt-2 font-serif italic text-xs text-muted-foreground">
            인증 한 번에 하나만 골라요. 영양소는 자동으로 들어가요.
          </p>
        )}
      </div>

      {/* 스무디·퓨레 버튼 (2026-11-20) */}
      {isSmoothie && (
        <div className="mb-4 space-y-2">
          {PRODUCT_ROWS.map(row => (
            <div key={row}>
              <div className="text-[11px] text-muted-foreground mb-1">{row}</div>
              <div className="grid grid-cols-3 gap-2">
                {PRODUCTS.filter(p => p.row === row).map(p => {
                  const n = picked[p.id] ?? 0;
                  return (
                    <div key={p.id} className={cn("relative rounded-lg border transition-colors", n > 0 ? "border-primary bg-primary/15" : "border-border")}>
                      {/* 한 번 인증 = 한 개만 (2026-11-21): 다른 걸 누르면 바뀌고, 같은 걸 다시 누르면 취소 */}
                      <button
                        type="button"
                        onClick={() => setPicked(prev => (prev[p.id] ? {} : { [p.id]: 1 }))}
                        className="w-full h-full min-h-[44px] px-2 py-2 text-xs flex items-center justify-center gap-1.5"
                      >
                        <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                        <span className="text-left leading-tight break-keep">{p.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {pickedList.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {pickedList.map(p => p.name).join("")} · 탄 {pickedList.reduce((a, p) => a + p.carbsG, 0)}g · 단 {pickedList.reduce((a, p) => a + p.proteinG, 0)}g · 지 {pickedList.reduce((a, p) => a + p.fatG, 0)}g
            </div>
          )}
        </div>
      )}

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

          {/* 사진 AI 분석 (2026-11-20) */}
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={photos.length === 0 || analyze.isPending}
              onClick={() => analyze.mutate({ photoBase64: photos.slice(0, 4) })}
              className="rounded-none border-primary text-primary"
            >
              {analyze.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />AI가 보는 중…</> : <><Sparkles className="h-4 w-4 mr-2" />사진으로 자동 채우기</>}
            </Button>
            <span className="text-xs text-muted-foreground leading-relaxed">아래에 사진을 먼저 올리고 누르세요.<br /><b className="text-primary">AI 인식은 오류가 있을 수 있어요.</b> 숫자는 직접 고쳐도 되고, <b className="text-foreground">직접 기입이 가장 정확해요.</b></span>
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
            <div key={idx} className="relative w-16 h-16 rounded-lg border hairline overflow-hidden">
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
            <label className="w-16 h-16 rounded-lg border-dashed border-2 border-foreground/20 hover:border-foreground/50 flex items-center justify-center cursor-pointer transition-colors">
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
              try {
                if (pickedList.length > 0) {
                  // 고른 스무디 1개 = 인증 1회. 사진은 순서대로 붙이고 남는 사진은 첫 기록에 붙인다.
                  for (let i = 0; i < pickedList.length; i++) {
                    const p = pickedList[i];
                    const ph = i === 0 ? [photos[0], ...photos.slice(pickedList.length)] : photos[i] ? [photos[i]] : [];
                    await create.mutateAsync({
                      recordedDate: date,
                      category: "smoothie",
                      description: p.name,
                      carbsG: p.carbsG, proteinG: p.proteinG, fatG: p.fatG, vegetableG: p.vegetableG,
                      photoBase64: ph.filter(Boolean).slice(0, 8),
                    });
                  }
                } else {
                  // 버튼을 안 고른 경우: 예전처럼 사진 N장 = 인증 N회
                  for (const p of photos) {
                    await create.mutateAsync({ recordedDate: date, category: "smoothie", photoBase64: [p] });
                  }
                }
                onCreated({
                  item: "smoothie", label: "스무디", emoji: "🥤", photo: photos[0],
                  feedback: pickedList.length
                    ? `${pickedList.map(p => p.name).join(" · ")} · 탄 ${pickedList.reduce((a, p) => a + p.carbsG, 0)}g · 단 ${pickedList.reduce((a, p) => a + p.proteinG, 0)}g · 지 ${pickedList.reduce((a, p) => a + p.fatG, 0)}g`
                    : "오늘도 스무디로 몸을 챙겼어요",
                });
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
            try {
              await create.mutateAsync({
                recordedDate: date,
                category,
                description: description.trim() || undefined,
                ...numbers,
                photoBase64: photos,
              });
            } catch { return; }
            onCreated({
              item: "meal", label: "일반식", emoji: "🥗", photo: photos[0],
              feedback: `${description.trim() || "건강한 한 끼"} · 탄 ${numbers.carbsG}g · 단 ${numbers.proteinG}g · 지 ${numbers.fatG}g`,
            });
          }}
          disabled={create.isPending}
          className="rounded-none uppercase tracking-wider"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "자랑하기"}
        </Button>
      </div>
    </div>
  );
}

function DailyNutritionTotals({ meals, date }: { meals: MealRow[]; date: string }) {
  // 2026-11-21: 내 몸(키·몸무게·나이·성별·활동량)과 그날 운동으로 계산한 권장량 + 부족/넘침 한 줄
  const intake = trpc.wellness.intake.useQuery({ date }, { staleTime: 30_000 });
  const [showBasis, setShowBasis] = useState(false);
  const T = intake.data?.targets ?? DAILY_TARGET;
  const sum = meals.reduce(
    (a, m) => ({ carbsG: a.carbsG + (m.carbsG || 0), proteinG: a.proteinG + (m.proteinG || 0), fatG: a.fatG + (m.fatG || 0), vegetableG: a.vegetableG + (m.vegetableG || 0) }),
    { carbsG: 0, proteinG: 0, fatG: 0, vegetableG: 0 },
  );
  const rows: Array<{ k: keyof typeof sum; label: string }> = [
    { k: "carbsG", label: "탄수화물" },
    { k: "proteinG", label: "단백질" },
    { k: "fatG", label: "지방" },
    { k: "vegetableG", label: "채소" },
  ];
  return (
    <div className="border border-border bg-card p-5">
      <div className="editorial-eyebrow text-primary mb-3">TODAY TOTAL · 오늘 먹은 양</div>
      <div className="space-y-3">
        {rows.map(r => {
          const v = sum[r.k];
          const target = (T as any)[r.k] as number;
          const pct = Math.min(100, Math.round((v / target) * 100));
          return (
            <div key={r.k}>
              <div className="flex justify-between text-sm mb-1">
                <span>{r.label}</span>
                <span className="tabular-nums"><b className={v >= target ? "text-primary" : ""}>{v}g</b><span className="text-muted-foreground"> / {target}g</span></span>
              </div>
              <div className="h-2 bg-secondary">
                <div className="h-2 bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {intake.data?.line && (
        <p className={cn("mt-4 text-sm font-semibold leading-snug rounded-lg px-3 py-2",
          intake.data.level === "low" ? "bg-rose-500/15 text-rose-300 border border-rose-400/50"
            : intake.data.level === "high" ? "bg-amber-500/10 text-amber-200 border border-amber-400/40"
            : "bg-primary/10 text-primary border border-primary/30")}>
          {intake.data.line}
        </p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        {intake.data?.targets ? "내 키·몸무게·나이·활동량과 오늘 운동으로 계산한 권장량이에요." : "기본 권장 기준이에요."}{" "}
        <button type="button" onClick={() => setShowBasis(!showBasis)} className="underline">근거 보기</button>
      </p>
      {showBasis && (
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          보건복지부·한국영양학회 「한국인 영양소 섭취기준」의 에너지필요추정량 공식(성별·나이·키·몸무게·신체활동)으로 하루 필요량을 구하고, 운동은 국제 신체활동 기준표(Compendium of Physical Activities)로 더했어요. 탄수화물 약 55%, 지방 25%, 단백질은 몸무게 1kg당 1.2g으로 나눴어요. 공식으로 계산한 참고 안내이며, 질환·임신·복용 약이 있으면 의사·전문가 지침이 우선이에요.
        </p>
      )}
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

/** 운동 기록 (2026-11-21 새로): 종류 목록 · 종류별 칸 · 워치 캡처 자동 채우기 · 운동 느낌(편안/적당/숨이 턱끝까지 + 땀 폭발) · 종합 코멘트 */
const FEEL_OPTS = [
  { v: "easy", emoji: "😌", label: "편안해요", hint: "말하면서 할 수 있음" },
  { v: "ok", emoji: "🙂", label: "적당해요", hint: "숨이 조금 참" },
  { v: "max", emoji: "🔥", label: "숨이 턱끝까지", hint: "말하기 힘들 만큼" },
] as const;
const numOrNull = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : null; };
function paceToSec(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})\D+(\d{1,2})/); if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}
const secToPace = (s?: number | null) => (s ? `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"` : "");

function ExerciseSection({ date, exercises, exerciseCount, userName, onChange, onBrag }: { date: string; exercises: ExRow[]; exerciseCount?: number; userName?: string; onChange: () => void; onBrag?: BragFn }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const sports = trpc.wellness.sports.useQuery(undefined, { staleTime: Infinity });
  const [sport, setSport] = useState("walk");
  const [minutes, setMinutes] = useState("");
  const [km, setKm] = useState("");
  const [pace, setPace] = useState("");
  const [speed, setSpeed] = useState("");
  const [steps, setSteps] = useState("");
  const [hr, setHr] = useState("");
  const [laps, setLaps] = useState("");
  const [kcal, setKcal] = useState("");
  const [feel, setFeel] = useState<"easy" | "ok" | "max">("ok");
  const [sweat, setSweat] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [lastComment, setLastComment] = useState<{ text: string; warn: boolean } | null>(null);
  const exFileRef = useRef<HTMLInputElement>(null);
  const kind = sports.data?.find(s => s.id === sport)?.kind ?? "time";
  const details = trpc.wellness.exerciseDetails.useQuery({ ids: exercises.map(x => x.id) }, { enabled: exercises.length > 0 });

  const reset = () => { setMinutes(""); setKm(""); setPace(""); setSpeed(""); setSteps(""); setHr(""); setLaps(""); setKcal(""); setFeel("ok"); setSweat(false); setPhoto(null); if (exFileRef.current) exFileRef.current.value = ""; };
  const create = trpc.wellness.createExercise.useMutation({
    onSuccess: (r) => {
      setLastComment({ text: r.comment, warn: r.warn });
      onBrag?.({ item: "exercise", label: "운동", emoji: "💪", photo: photo ?? undefined, feedback: `${r.what} · ${r.comment.replace(/^⚠️\s*/, "")}` });
      reset(); onChange();
    },
    onError: (e) => toast.error(e.message),
  });
  const analyze = trpc.wellness.analyzeWorkout.useMutation({
    onSuccess: (r) => {
      setSport(r.sport);
      if (r.minutes) setMinutes(String(r.minutes)); if (r.distanceKm) setKm(String(r.distanceKm)); if (r.paceSec) setPace(secToPace(r.paceSec));
      if (r.speedKmh) setSpeed(String(r.speedKmh)); if (r.steps) setSteps(String(r.steps)); if (r.avgHr) setHr(String(r.avgHr));
      if (r.laps) setLaps(String(r.laps)); if (r.kcal) setKcal(String(r.kcal));
      toast.success("캡처에서 숫자를 읽어 채웠어요. 맞는지 확인해 주세요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.exercises.delete.useMutation({ onSuccess: () => { onChange(); toast.success("삭제되었습니다"); }, onError: (e) => toast.error(e.message) });

  const handleExPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 업로드할 수 있어요."); return; }
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };
  const submit = () => {
    const m = parseInt(minutes);
    if (!m) { toast.error("운동한 시간(분)을 입력해 주세요"); return; }
    if (!photo) { toast.error("운동 사진(또는 워치 캡처)을 1장 올려 주세요"); return; }
    create.mutate({
      recordedDate: date, sport, minutes: m, feel, sweat, photoBase64: photo,
      distanceKm: kind === "swim" ? (numOrNull(km) ? numOrNull(km)! / 1000 : null) : numOrNull(km),
      paceSec: kind === "distance" ? paceToSec(pace) : null,
      speedKmh: kind === "cycle" ? numOrNull(speed) : null,
      steps: kind === "distance" && numOrNull(steps) ? Math.round(numOrNull(steps)!) : null,
      avgHr: numOrNull(hr) ? Math.round(numOrNull(hr)!) : null,
      laps: kind === "swim" && numOrNull(laps) ? Math.round(numOrNull(laps)!) : null,
      kcalWatch: numOrNull(kcal) ? Math.round(numOrNull(kcal)!) : null,
    });
  };
  const field = (label: string, v: string, set: (s: string) => void, ph: string, mode: "numeric" | "decimal" | "text" = "decimal") => (
    <label className="text-[11px] text-muted-foreground">{label}
      <input inputMode={mode} value={v} onChange={e => set(e.target.value)} placeholder={ph} className="mt-0.5 w-full h-10 rounded-lg border border-border bg-transparent px-2 text-sm text-foreground" />
    </label>
  );

  const opened = exercises.find(x => x.id === openId) as (ExRow & { photoUrl?: string | null }) | undefined;
  const openedD = (details.data ?? []).find((d: any) => Number(d.exerciseId) === openId) as any;
  return (
    <div className="space-y-3">
      <h2 className="text-lg md:text-xl font-semibold">{userName ? `${userName} 운동 기록` : "운동 기록"}</h2>

      {/* 1. 사진 · 워치 캡처 */}
      <div className="flex items-center gap-3">
        {photo ? (
          <div className="relative w-16 h-16 rounded-lg border border-border overflow-hidden shrink-0">
            <img src={photo} alt="운동 사진" className="w-full h-full object-cover" />
            <button type="button" onClick={() => { setPhoto(null); if (exFileRef.current) exFileRef.current.value = ""; }} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <label className="w-16 h-16 rounded-lg border-dashed border-2 border-foreground/20 flex flex-col items-center justify-center cursor-pointer shrink-0">
            <input ref={exFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleExPhoto(e.target.files[0])} />
            <Camera className="h-5 w-5 text-muted-foreground" />
          </label>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground">운동 사진 또는 워치 기록 캡처 (필수)</div>
          <button type="button" disabled={!photo || analyze.isPending} onClick={() => photo && analyze.mutate({ photoBase64: photo })}
            className="mt-1 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-primary text-primary text-sm disabled:opacity-40">
            {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 캡처로 자동 채우기
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">워치·운동 앱 기록 화면을 캡처해 올리고 누르면 숫자가 채워져요. <b className="text-primary">AI 인식은 오류가 있을 수 있어요.</b> 워치가 없으면 직접 적어도 돼요. <b className="text-foreground">직접 기입이 가장 정확해요.</b></p>

      {/* 2. 운동 종류 */}
      <Select value={sport} onValueChange={setSport}>
        <SelectTrigger className="rounded-lg h-11"><SelectValue placeholder="운동 종류" /></SelectTrigger>
        <SelectContent>{(sports.data ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>

      {/* 3. 종류별 칸 */}
      <div className="grid grid-cols-3 gap-2">
        {field("시간(분)*", minutes, setMinutes, "30", "numeric")}
        {kind === "distance" && <>{field("거리(km)", km, setKm, "5.2")}{field("평균 페이스", pace, setPace, "6'30\"", "text")}{field("걸음 수", steps, setSteps, "6500", "numeric")}</>}
        {kind === "cycle" && <>{field("거리(km)", km, setKm, "15")}{field("평균 속도(km/h)", speed, setSpeed, "18")}</>}
        {kind === "swim" && <>{field("거리(m)", km, setKm, "1000", "numeric")}{field("바퀴 수", laps, setLaps, "40", "numeric")}</>}
        {field("평균 심박수", hr, setHr, "135", "numeric")}
        {field("워치 칼로리(참고)", kcal, setKcal, "선택", "numeric")}
      </div>

      {/* 4. 운동 느낌 */}
      <div>
        <div className="text-[11px] text-muted-foreground mb-1">오늘 운동 느낌 (위 셋 중 하나 + 땀 폭발은 같이 눌러도 돼요)</div>
        <div className="grid grid-cols-4 gap-1.5">
          {FEEL_OPTS.map(o => (
            <button key={o.v} type="button" onClick={() => setFeel(o.v)}
              className={cn("rounded-lg border px-1 py-2 text-[11px] leading-tight", feel === o.v ? "border-primary bg-primary/15 text-primary font-semibold" : "border-border text-muted-foreground")}>
              <div className="text-base">{o.emoji}</div>{o.label}
            </button>
          ))}
          <button type="button" onClick={() => setSweat(!sweat)}
            className={cn("rounded-lg border px-1 py-2 text-[11px] leading-tight", sweat ? "border-sky-400 bg-sky-400/15 text-sky-300 font-semibold" : "border-border text-muted-foreground")}>
            <div className="text-base">💦</div>땀 폭발
          </button>
        </div>
      </div>

      <Button onClick={submit} disabled={create.isPending} className="w-full rounded-xl h-11">
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "자랑하기"}
      </Button>
      {lastComment && (
        <p className={cn("text-sm rounded-lg px-3 py-2", lastComment.warn ? "bg-rose-500/15 text-rose-300 border border-rose-400/50" : "bg-primary/10 text-primary border border-primary/30")}>{lastComment.text}</p>
      )}

      <Medals items={exercises.map((x, i) => ({ id: x.id, label: `${i + 1}회`, sub: `${x.durationMin}분` }))} onOpen={setOpenId} total={exerciseCount} />
      <Popup open={!!opened} onClose={() => setOpenId(null)}>
        {opened && (
          <div className="space-y-3">
            {opened.photoUrl && <img src={opened.photoUrl} alt="" className="w-full rounded-xl object-cover max-h-[60vh]" />}
            <div className="text-lg font-semibold">{opened.kind}</div>
            <div className="text-sm text-muted-foreground">
              {[`${opened.durationMin}분`, openedD?.distanceKm ? `${Number(openedD.distanceKm)}km` : null, openedD?.paceSec ? `페이스 ${secToPace(Number(openedD.paceSec))}` : null,
                openedD?.avgHr ? `심박 ${openedD.avgHr}` : null, openedD ? FEEL_OPTS.find(f => f.v === openedD.feel)?.label : INTENSITY_OPTS.find(o => o.value === opened.intensity)?.label,
                openedD && Number(openedD.sweat) ? "땀 폭발" : null].filter(Boolean).join(" · ")}
            </div>
            {openedD?.comment && <div className="text-sm">{openedD.comment}</div>}
            {opened.note && <div className="text-sm">{opened.note}</div>}
            <Button variant="outline" onClick={() => { del.mutate({ id: opened.id }); setOpenId(null); }} className="rounded-full text-destructive border-destructive/50">
              <Trash2 className="h-4 w-4 mr-1" /> 삭제
            </Button>
          </div>
        )}
      </Popup>
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
const SLEEP_BED_CHOICES = [20, 21, 22, 23, 0, 1, 2];
const SLEEP_WAKE_CHOICES = [4, 5, 6, 7, 8, 9];
function fmtClock(h: number): string {
  if (h === 0) return "밤 12시";
  if (h < 12) return `${h <= 5 ? "새벽" : "아침"} ${h}시`;
  return `밤 ${h - 12}시`;
}

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

function SleepSection({ date, sleepCount, onBrag }: { date: string; sleepCount?: number; onBrag?: BragFn }) {
  const [wakePhoto, setWakePhoto] = useState<string | null>(null);
  const wakeRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const todaySleep = trpc.sleep.byDate.useQuery({ date });
  const sleepHistory = trpc.sleep.list.useQuery({ since: undefined } as any);

  const [bedHour, setBedHour] = useState<number>(23);
  const [bedMinute, setBedMinute] = useState<number>(0);
  const [wakeHour, setWakeHour] = useState<number>(7);
  const [wakeMinute, setWakeMinute] = useState<number>(0);

  // 기존 기록 있으면 최초 1회만 입력값을 동기화한다 (render-phase setState 회피)
  const initRef = useRef<string | null>(null);
  useEffect(() => {
    if (todaySleep.isLoading || initRef.current === date) return;
    initRef.current = date;
    setBedHour(todaySleep.data?.bedHour ?? 23);
    setBedMinute(todaySleep.data?.bedMinute ?? 0);
    setWakeHour(todaySleep.data?.wakeHour ?? 7);
    setWakeMinute(todaySleep.data?.wakeMinute ?? 0);
  }, [todaySleep.data, todaySleep.isLoading, date]);

  const evalResult = useMemo(
    () => evaluateSleepClient(bedHour, bedMinute, wakeHour, wakeMinute),
    [bedHour, bedMinute, wakeHour, wakeMinute],
  );

  const upsertSleep = trpc.sleep.upsert.useMutation({
    onSuccess: () => {
      utils.sleep.byDate.invalidate();
      utils.sleep.list.invalidate();
      utils.seasons.myProgress.invalidate();
      utils.happy.yearProgress.invalidate();
      const d = computeSleepMin(bedHour, bedMinute, wakeHour, wakeMinute);
      onBrag?.({ item: "wake", label: "기상", emoji: "☀️", photo: wakePhoto ?? undefined, feedback: `${fmtClock(bedHour)} 취침 · ${fmtClock(wakeHour)} 기상 · ${Math.floor(d / 60)}시간${d % 60 ? ` ${d % 60}분` : ""} · ${evaluateSleepClient(bedHour, bedMinute, wakeHour, wakeMinute).message}` });
      setWakePhoto(null); if (wakeRef.current) wakeRef.current.value = "";
    },
  });

  const handleSave = () => {
    if (!wakePhoto) { toast.error("아침 따뜻한 물 한 잔 사진을 올려 주세요"); return; }
    upsertSleep.mutate({
      photoBase64: wakePhoto,
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

  const short = (h: number) => (h === 0 ? "12시" : `${h > 12 ? h - 12 : h}시`);
  const dotColor = (dur: number) => dur < 300 ? "bg-rose-400" : dur < 420 ? "bg-amber-400" : dur <= 510 ? "bg-primary" : "bg-purple-400";
  return (
    <section className="mb-4 rounded-2xl bg-card border border-border p-4 md:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold">
          수면 기록{sleepCount != null && <span className="ml-2 text-sm font-normal text-primary tabular-nums">{sleepCount}회</span>}
        </h2>
        {recent.length > 0 && (
          <div className="flex items-center gap-1" title="최근 7일">
            {recent.map(s => <span key={s.id} className={cn("w-2 h-2 rounded-full", dotColor(s.durationMinutes))} />)}
          </div>
        )}
      </div>
      {/* 취침 한 줄 (밤 8시~새벽 2시) */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 text-xs text-muted-foreground shrink-0">취침</span>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {SLEEP_BED_CHOICES.map(h => (
            <button key={h} type="button" onClick={() => { setBedHour(h); setBedMinute(0); }}
              className={cn("rounded-lg py-2 text-xs tabular-nums border transition-colors",
                bedHour === h ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground")}>
              {short(h)}
            </button>
          ))}
        </div>
      </div>
      {/* 기상 한 줄 (새벽 4시~아침 9시) */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 text-xs text-muted-foreground shrink-0">기상</span>
        <div className="grid grid-cols-6 gap-1 flex-1">
          {SLEEP_WAKE_CHOICES.map(h => (
            <button key={h} type="button" onClick={() => { setWakeHour(h); setWakeMinute(0); }}
              className={cn("rounded-lg py-2 text-xs tabular-nums border transition-colors",
                wakeHour === h ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground")}>
              {short(h)}
            </button>
          ))}
        </div>
      </div>
      {/* 기상 인증: 아침 따뜻한 물 한 잔 사진 (필수) */}
      <div className="flex items-center gap-2 mb-3">
        {wakePhoto ? (
          <div className="relative w-14 h-14 rounded-lg border border-border overflow-hidden">
            <img src={wakePhoto} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => { setWakePhoto(null); if (wakeRef.current) wakeRef.current.value = ""; }} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <label className="w-14 h-14 rounded-lg border-dashed border-2 border-primary/50 flex items-center justify-center cursor-pointer">
            <input ref={wakeRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (!fl) return; const r = new FileReader(); r.onload = () => setWakePhoto(String(r.result)); r.readAsDataURL(fl); }} />
            <Camera className="h-5 w-5 text-primary" />
          </label>
        )}
        <span className="text-xs text-muted-foreground">☀️ 기상 인증 · 아침을 깨우는 <b className="text-foreground">따뜻한 물 한 잔</b> 사진 (필수)</span>
      </div>
      {/* 결과 + 자랑하기 한 줄 */}
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold tabular-nums">{hours}시간{mins ? ` ${mins}분` : ""}</span>
        <span className={cn("text-xs flex-1",
          evalResult.status === "danger" ? "text-rose-300" : evalResult.status === "warning" ? "text-amber-300" : evalResult.status === "good" ? "text-primary" : "text-purple-300")}>
          {evalResult.message}
        </span>
        <Button onClick={handleSave} disabled={upsertSleep.isPending} className="rounded-full px-5 h-9">
          {upsertSleep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "자랑하기"}
        </Button>
      </div>
    </section>
  );
}

/* ----------------- 공통: 자랑하기 형식 · 큰 횟수 배지 · 메달 · 팝업 (2026-11-20) ----------------- */
export type BragItem = "meal" | "smoothie" | "water" | "exercise" | "wake" | "weight";
export type BragFn = (p: { item: BragItem; label: string; emoji: string; photo?: string; feedback: string }) => void;

function CountBadge({ n }: { n?: number | null }) {
  if (n == null) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[3rem] h-12 px-2 rounded-full border-2 border-primary text-primary text-xl font-bold tabular-nums shadow-[0_0_10px_var(--primary-glow,rgba(182,242,74,0.35))]">
      {n}회
    </span>
  );
}

/** 오늘 메달(1회·2회…, 날마다 새로 시작) + 맨 끝에 '누적 N회' 동그라미 (2026-11-21) */
function Medals({ items, onOpen, total }: { items: Array<{ id: number; label: string; sub?: string }>; onOpen: (id: number) => void; total?: number }) {
  if (!items.length && total == null) return null;
  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map(it => (
        <button key={it.id} type="button" onClick={() => onOpen(it.id)}
          className="aspect-square rounded-full border-2 border-primary/70 bg-primary/10 flex flex-col items-center justify-center text-primary hover:bg-primary/20 transition-colors">
          <span className="text-sm font-bold leading-none">{it.label}</span>
          {it.sub && <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">{it.sub}</span>}
        </button>
      ))}
      {total != null && (
        <div className="aspect-square rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-[0_0_12px_var(--primary-glow,rgba(182,242,74,0.45))]">
          <span className="text-[10px] font-semibold leading-none opacity-80">누적</span>
          <span className="text-lg font-black leading-tight tabular-nums">{total}회</span>
        </div>
      )}
    </div>
  );
}

function Popup({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border p-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end mb-1"><button type="button" onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

/* ----------------- 날짜 도우미 ----------------- */
function shiftDate(d: string, days: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + days));
  return t.toISOString().slice(0, 10);
}
function formatShortDate(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${m}/${dd}(${w})`;
}

/** 날짜 아래 두 줄 (2026-11-21): 윗줄 오늘의 명언(누가 했는지) · 아랫줄 어제 돌아보기 코멘트 — 꾸미기에서 켠 것만. 사주·운세는 뺐다 */
function DailyLines({ date }: { date: string }) {
  const prefs = loadDecor();
  const showQuote = prefs.quote !== false;
  const q = trpc.happy.dailyLines.useQuery(
    { date, fortune: false, coach: !!prefs.coach },
    { enabled: !!prefs.coach, staleTime: 6 * 3600_000, retry: false, refetchOnWindowFocus: false },
  );
  if (!showQuote && !prefs.coach) return null;
  const qt = quoteOf(date);
  return (
    <div className="mt-1 space-y-1 text-xs leading-snug text-muted-foreground max-w-[18rem] mx-auto">
      {showQuote && <div>“{qt.text}” <span className="opacity-70">— {qt.by}</span></div>}
      {prefs.coach && q.isLoading && <div>어제 기록을 돌아보고 있어요…</div>}
      {prefs.coach && q.data?.coach && <div className="text-foreground/85">🌱 {q.data.coach}</div>}
    </div>
  );
}

function formatKoDate(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${m}월 ${dd}일 ${w}요일`;
}

/* ----------------- 따·잠·마·음·운 매일 체크 (2026-11-20) ----------------- */
function DailyChecklist({ date, autoSlept, autoCleanEat, autoExercised }: { date: string; autoSlept: boolean; autoCleanEat: boolean; autoExercised: boolean }) {
  const utils = trpc.useUtils();
  const note = trpc.happy.byDate.useQuery({ date });
  const [mood, setMood] = useState(0);
  const [warm, setWarm] = useState(false);
  const [slept, setSlept] = useState(false);
  const [cleanEat, setCleanEat] = useState(false);
  const [exercised, setExercised] = useState(false);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (note.isLoading || loadedFor.current === date) return;
    loadedFor.current = date;
    const n = note.data;
    setMood(n?.mood ?? 0);
    setWarm(!!n?.warm); setSlept(!!n?.slept); setCleanEat(!!n?.cleanEat); setExercised(!!n?.exercised);
  }, [note.data, note.isLoading, date]);

  const save = trpc.happy.saveChecks.useMutation({
    onSuccess: () => { utils.happy.byDate.invalidate(); utils.happy.yearProgress.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const persist = (next: Partial<{ mood: number; warm: boolean; slept: boolean; cleanEat: boolean; exercised: boolean }>) => {
    const v = { mood, warm, slept, cleanEat, exercised, ...next };
    save.mutate({ date, ...v });
  };

  const rows: Array<{ key: string; head: string; label: string; checked: boolean; auto?: boolean; toggle?: () => void }> = [
    { key: "warm", head: "따", label: "어제 나는 몸을 따뜻하게 했어요", checked: warm, toggle: () => { setWarm(!warm); persist({ warm: !warm }); } },
    { key: "slept", head: "잠", label: "어제 나는 푹 잤어요", checked: slept || autoSlept, auto: autoSlept && !slept, toggle: () => { setSlept(!slept); persist({ slept: !slept }); } },
    { key: "mind", head: "마", label: "어제 내 마음 알아차리기 (어제 나의 기분은)", checked: mood > 0 },
    { key: "eat", head: "음", label: "어제 나는 한 끼 이상 클린하게 먹었어요", checked: cleanEat || autoCleanEat, auto: autoCleanEat && !cleanEat, toggle: () => { setCleanEat(!cleanEat); persist({ cleanEat: !cleanEat }); } },
    { key: "move", head: "운", label: "어제 나는 운동을 했어요", checked: exercised || autoExercised, auto: autoExercised && !exercised, toggle: () => { setExercised(!exercised); persist({ exercised: !exercised }); } },
  ];
  const done = rows.filter(r => r.checked).length;

  return (
    <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg md:text-xl font-semibold">어제의 따·잠·마·음·운</h2>
        <span className="text-sm text-muted-foreground tabular-nums"><b className="text-primary">{done}</b> / 5</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map(r => (
          <li key={r.key} className="py-2.5 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={r.toggle}
              disabled={!r.toggle}
              className={cn(
                "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                r.checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50",
              )}
              aria-label={r.label}
            >
              {r.checked && <span className="text-sm font-bold leading-none">✓</span>}
            </button>
            <span className="w-6 text-primary font-bold">{r.head}</span>
            <span className={cn("text-sm", r.checked ? "text-foreground" : "text-muted-foreground")}>{r.label}</span>
            {r.auto && <span className="text-[10px] text-primary/80">인증 자동 체크</span>}
            {r.key === "mind" && (
              <div className="flex gap-1 ml-auto">
                {MOODS.map(m => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => { setMood(m.v); persist({ mood: m.v }); }}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs border transition-colors",
                      mood === m.v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60",
                    )}
                  >
                    {m.emoji} {m.short}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <ConditionCheck date={date} />
    </section>
  );
}

/** 컨디션 체크 (2026-11-21): 따잠마음운 아래, 마음 버튼과 같은 모양. 매일 체크, 점수엔 안 들어감 */
const CONDITION_OPTS = [
  { v: "best", emoji: "😆", label: "최상이에요" },
  { v: "ok", emoji: "🙂", label: "괜찮아요" },
  { v: "meh", emoji: "😐", label: "그저 그래요" },
  { v: "tired", emoji: "😩", label: "힘이 없어요" },
] as const;
function ConditionCheck({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const q = trpc.wellness.condition.useQuery({ date });
  const set = trpc.wellness.setCondition.useMutation({
    onSuccess: () => utils.wellness.condition.invalidate({ date }),
    onError: (e) => toast.error(e.message),
  });
  const cur = set.isPending ? set.variables?.level : q.data;
  return (
    <div className="pt-3 mt-1 border-t border-border">
      <div className="text-sm font-semibold text-primary mb-2">컨디션 체크 <span className="text-[11px] font-normal text-muted-foreground">오늘 내 몸은</span></div>
      <div className="flex flex-wrap gap-1">
        {CONDITION_OPTS.map(o => (
          <button key={o.v} type="button" onClick={() => set.mutate({ date, level: o.v })}
            className={cn("px-2 py-1 rounded-full text-xs border transition-colors",
              cur === o.v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60")}>
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------- Happy Diary Section (행복 한 줄 일기) ----------------- */
// 근거: Three Good Things(Seligman 2005), 감사 일기(Emmons & McCullough 2003), 감정에 이름 붙이기(Lieberman 2007)
const MOODS = [
  { v: 4, emoji: "😊", label: "행복했어요", short: "행복해요" },
  { v: 3, emoji: "🙂", label: "괜찮았어요", short: "괜찮아요" },
  { v: 2, emoji: "😐", label: "그저 그랬어요", short: "그저 그래요" },
  { v: 1, emoji: "😔", label: "힘들었어요", short: "힘들어요" },
];

function HappyDiarySection({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const note = trpc.happy.byDate.useQuery({ date });
  const [mood, setMood] = useState<number>(0);
  const [goodThing, setGoodThing] = useState("");
  const [promise, setPromise] = useState("");
  const initRef = useRef<string | null>(null);
  useEffect(() => {
    if (initRef.current === date || note.isLoading) return;
    initRef.current = date;
    setMood(note.data?.mood ?? 0);
    setGoodThing(note.data?.goodThing ?? "");
    setPromise(note.data?.promise ?? "");
  }, [note.data, note.isLoading, date]);

  const save = trpc.happy.upsert.useMutation({
    onSuccess: () => { utils.happy.byDate.invalidate(); toast.success("오늘의 한 줄이 저장됐어요 💚"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="editorial-eyebrow text-primary mb-2">01 · HAPPY NOTE</div>
          <h2 className="text-xl md:text-2xl font-semibold">행복 한 줄 일기</h2>
          <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
            10초면 끝나요. 좋았던 일을 적고 기분에 이름을 붙이면 마음이 가벼워진다는 연구가 있어요.
          </p>
        </div>
        <div className="col-span-12 md:col-span-8 space-y-5">
          <div>
            <div className="editorial-eyebrow text-muted-foreground mb-2">어제 내 기분은?</div>
            <div className="grid grid-cols-4 gap-2">
              {MOODS.map(m => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMood(m.v)}
                  className={cn(
                    "border py-3 flex flex-col items-center gap-1 transition-colors",
                    mood === m.v ? "border-primary bg-primary/15" : "border-border hover:border-primary/60",
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[11px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="editorial-eyebrow text-muted-foreground mb-2">어제 나를 위해 한 좋은 일 한 줄</div>
            <Input
              value={goodThing}
              maxLength={300}
              onChange={e => setGoodThing(e.target.value)}
              placeholder="예: 물 2리터 마셨다 / 아이랑 산책했다"
              className="rounded-none bg-transparent h-12"
            />
          </div>
          <div>
            <div className="editorial-eyebrow text-muted-foreground mb-2">오늘 나에게 해 줄 칭찬이나 작은 약속</div>
            <Input
              value={promise}
              maxLength={300}
              onChange={e => setPromise(e.target.value)}
              placeholder="예: 오늘은 밤 11시 전에 자기"
              className="rounded-none bg-transparent h-12"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (!mood) { toast.error("어제 기분을 먼저 골라 주세요."); return; }
                save.mutate({ date, mood, goodThing, promise });
              }}
              disabled={save.isPending}
              className="rounded-none px-8 h-12"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : note.data ? "수정" : "저장"}
            </Button>
          </div>
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
    <section className="mb-4 rounded-2xl bg-card border border-border p-5 md:p-7">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="editorial-eyebrow text-muted-foreground mb-2">02 · TRANSFORMATION</div>
          <h2 className="text-xl md:text-2xl font-semibold">비포 / 애프터</h2>
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

function WaterSection({ date, waterCount, userName, onBrag }: { date: string; waterCount?: number; userName?: string; onBrag?: BragFn }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const lastPhotos = useRef<string[]>([]);
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
      utils.waters.byDate.invalidate(); utils.rounds.myCounts.invalidate();
      utils.seasons.myProgress.invalidate();
      toast.success(`물 ${res.count}회 기록되었습니다 (${(volumeMl * res.count).toLocaleString()}ml)`);
      const newTotal = totalMl + volumeMl * res.count;
      onBrag?.({ item: "water", label: "물", emoji: "💧", photo: lastPhotos.current[0],
        feedback: `${volumeMl}ml · 오늘 ${newTotal.toLocaleString()}ml (목표의 ${Math.min(100, Math.round(newTotal / WATER_DAILY_TARGET_ML * 100))}%)` });
      setPhotos([]);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.waters.delete.useMutation({
    onSuccess: () => {
      utils.waters.byDate.invalidate(); utils.rounds.myCounts.invalidate();
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

  const opened = items.find(it => it.id === openId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg md:text-xl font-semibold">{userName ? `${userName} 물 기록` : "물 기록"}</h2>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">오늘 누적</div>
          <div className="text-2xl font-bold tabular-nums text-primary">{totalMl.toLocaleString()}<span className="text-sm ml-0.5">ml</span></div>
        </div>
      </div>
      <div>
        <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
          <span>{totalMl >= WATER_DAILY_TARGET_ML ? "오늘 수분 목표 달성!" : `목표 ${WATER_DAILY_TARGET_ML.toLocaleString()}ml까지 ${(WATER_DAILY_TARGET_ML - totalMl).toLocaleString()}ml`}</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
      </div>

      {/* 한 잔당 용량 */}
      <div className="grid grid-cols-4 gap-1.5">
        {WATER_VOLUME_OPTIONS.map((v) => (
          <button key={v} type="button" onClick={() => setVolumeMl(v)}
            className={cn("rounded-lg border py-2 text-xs tabular-nums whitespace-nowrap transition-colors",
              volumeMl === v ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground")}>
            {v}ml
          </button>
        ))}
      </div>

      {/* 사진 (1장 = 1회, 최대 8장) + 자랑하기 */}
      <div className="flex items-center gap-2 flex-wrap">
        {photos.map((p, idx) => (
          <div key={idx} className="relative w-14 h-14 rounded-lg border border-border overflow-hidden">
            <img src={p} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {photos.length < 8 && (
          <label className="w-14 h-14 rounded-lg border-dashed border-2 border-foreground/20 flex items-center justify-center cursor-pointer">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <Plus className="h-5 w-5 text-muted-foreground" />
          </label>
        )}
        <Button
          onClick={() => {
            if (photos.length === 0) { toast.error("물 사진을 1장 이상 첨부해 주세요"); return; }
            lastPhotos.current = photos;
            create.mutate({ recordedDate: date, volumeMl, photoBase64: photos });
          }}
          disabled={create.isPending}
          className="ml-auto rounded-full px-5 h-10"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "자랑하기"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">사진 1장 = 1회 · 최대 8장</p>

      {/* 오늘 마신 물: 메달 (누르면 사진 · 삭제) */}
      <Medals items={items.map((it, i) => ({ id: it.id, label: `${i + 1}회`, sub: `${it.volumeMl}ml` }))} onOpen={setOpenId} total={waterCount} />
      <Popup open={!!opened} onClose={() => setOpenId(null)}>
        {opened && (
          <div className="space-y-3">
            <img src={opened.photoUrl} alt="" className="w-full rounded-xl object-cover max-h-[60vh]" />
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold tabular-nums">{opened.volumeMl}ml</span>
              <Button variant="outline" onClick={() => { del.mutate({ id: opened.id }); setOpenId(null); }} className="rounded-full text-destructive border-destructive/50">
                <Trash2 className="h-4 w-4 mr-1" /> 삭제
              </Button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}
/* ----------------- Kakao Share Banner ----------------- */
function KakaoShareBanner({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm shadow-lg">
      <div className="border hairline bg-[#FEE500] px-5 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-[#3C1E1E] uppercase tracking-wider mb-0.5">인증 완료!</div>
          <div className="text-sm text-[#3C1E1E] font-serif truncate">{text.split("\n")[0]}</div>
        </div>
        <Button
          size="sm"
          className="rounded-none bg-[#3C1E1E] text-[#FEE500] hover:bg-[#2a1414] shrink-0 h-9 px-4 text-xs font-bold uppercase tracking-wider"
          onClick={() => { shareKakao(text); onClose(); }}
        >
          카톡 공유
        </Button>
        <button onClick={onClose} className="text-[#3C1E1E]/60 hover:text-[#3C1E1E] shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
