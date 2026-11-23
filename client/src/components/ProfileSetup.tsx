// 처음 가입 때 필수 정보 (2026-11-21): 카톡방과 같은 프로필 사진 · 성별 · 태어난 해 · 키 · 몸무게 · 활동량 + 선택 몸 상태
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import InstallButton, { isStandalone } from "./InstallButton";
import { useAuth } from "@/_core/hooks/useAuth";

const FLAGS: Array<{ id: "diabetes" | "kidney" | "thyroid" | "eating" | "heart" | "doctor"; label: string }> = [
  { id: "diabetes", label: "당뇨 또는 혈당약 복용" },
  { id: "kidney", label: "신장(콩팥) 질환" },
  { id: "thyroid", label: "갑상선 질환" },
  { id: "eating", label: "섭식장애를 겪었거나 겪는 중" },
  { id: "heart", label: "심장·혈압 질환, 최근 수술·부상" },
  { id: "doctor", label: "의사에게 식단·운동 제한을 받음" },
];

/** 사진은 크루가 준 그대로(자르지 않고) 크기만 줄여서 dataURL로 (2026-11-22: 얼굴 위주로 자르지 않기) */
function squareDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = rej; img.src = r.result as string;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

const chip = (on: boolean) => cn("px-2 py-2 rounded-xl border text-sm whitespace-nowrap transition-colors", on ? "border-primary bg-primary/15 text-primary font-semibold" : "border-border text-foreground/80");

export function ProfileForm({ onDone, editing }: { onDone?: () => void; editing?: boolean }) {
  const utils = trpc.useUtils();
  const me = trpc.wellness.myProfile.useQuery();
  const save = trpc.wellness.saveProfile.useMutation({
    onSuccess: () => { toast.success("저장했어요"); utils.wellness.myProfile.invalidate(); utils.auth.me.invalidate(); utils.members.list.invalidate(); onDone?.(); },
    onError: (e) => toast.error(e.message),
  });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [sex, setSex] = useState<"female" | "male">("female");
  const [birthYear, setBirthYear] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<"low" | "mid" | "high" | "">("");
  const [pregnant, setPregnant] = useState(false);
  const [lactating, setLactating] = useState(false);
  const [flags, setFlags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = me.data?.profile; if (!p) return;
    setSex(p.sex); setBirthYear(String(p.birthYear)); setHeight(String(p.heightCm)); setActivity(p.activity);
    if (editing && me.data?.weightKg) setWeight(String(me.data.weightKg));
    setPregnant(p.pregnant); setLactating(p.lactating); setFlags(p.flags); setNote(p.healthNote ?? ""); setConsent(p.healthConsent);
  }, [me.data?.profile]);

  const hasWeight = !!me.data?.weightKg;
  void hasWeight;
  const shownAvatar = avatar ?? me.data?.avatarUrl ?? null;

  const submit = () => {
    if (!shownAvatar) return toast.error("카톡방과 같은 프로필 사진을 꼭 올려 주세요.");
    const by = parseInt(birthYear), h = parseFloat(height), w = parseFloat(weight);
    if (!by || by < 1930 || by > 2015) return toast.error("태어난 해를 4자리로 입력해 주세요. (예: 1985)");
    if (!h || h < 120 || h > 220) return toast.error("키를 cm로 입력해 주세요.");
    if (!editing && (!w || w < 30 || w > 250)) return toast.error("몸무게를 kg로 입력해 주세요.");
    if (!activity) return toast.error("운동량을 골라 주세요.");
    if (note.trim() && !consent) return toast.error("몸 상태 메모를 저장하려면 동의에 체크해 주세요.");
    save.mutate({
      avatarBase64: avatar ?? undefined, sex, birthYear: by, heightCm: h, weightKg: w && w >= 30 && w <= 250 ? w : undefined, activity,
      pregnant: sex === "female" && pregnant, lactating: sex === "female" && lactating, flags: flags as any,
      healthNote: consent ? note.trim() || null : null, healthConsent: consent,
    });
  };

  // 2026-11-22 (해이): 처음 가입은 한 화면에 한 가지씩 — ① 사진 ② 기본 정보 ③ 운동량 ④ 몸 상태 (이전/다음)
  const [step, setStep] = useState(0);
  const stepped = !editing;
  const check = (i: number) => {
    if (i === 0 && !shownAvatar) { toast.error("카톡방과 같은 프로필 사진을 꼭 올려 주세요."); return false; }
    if (i === 1) {
      const by = parseInt(birthYear), h = parseFloat(height), w = parseFloat(weight);
      if (!by || by < 1930 || by > 2015) { toast.error("태어난 해를 4자리로 입력해 주세요. (예: 1985)"); return false; }
      if (!h || h < 120 || h > 220) { toast.error("키를 cm로 입력해 주세요."); return false; }
      if (!editing && (!w || w < 30 || w > 250)) { toast.error("몸무게를 kg로 입력해 주세요."); return false; }
    }
    if (i === 2 && !activity) { toast.error("운동량을 골라 주세요."); return false; }
    return true;
  };
  const show = (i: number) => !stepped || step === i;
  const big = "text-2xl font-black text-center leading-snug";

  if (me.isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {stepped && (
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2, 3].map(i => <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-primary" : "w-2 bg-muted")} />)}
        </div>
      )}

      {/* ① 프로필 사진 */}
      {show(0) && (
        <section className="space-y-4">
          {stepped ? <h2 className={big}>프로필 사진을<br />넣어 주세요</h2> : <div className="text-sm font-semibold">프로필 사진</div>}
          <button type="button" onClick={() => fileRef.current?.click()} className={cn("mx-auto rounded-full overflow-hidden border-2 border-dashed border-primary hover:bg-primary/10 flex items-center justify-center transition-colors", stepped ? "w-40 h-40" : "w-24 h-24")}>
            {shownAvatar ? <img src={shownAvatar} alt="" className="w-full h-full object-cover" /> : <Camera className="h-9 w-9 text-primary" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setAvatar(await squareDataUrl(f)); }} />
          <div className="text-center">
            <p className="text-[15px] font-bold text-rose-300 leading-snug">카톡방 프로필 사진과 똑같은 사진을<br />넣어 주세요.</p>
            <p className="text-xs text-muted-foreground mt-1.5">두 사진이 같아야 누가 올렸는지 매칭돼요.</p>
          </div>
        </section>
      )}

      {/* ② 기본 정보 */}
      {show(1) && (
        <section className="space-y-4">
          {stepped ? <h2 className={big}>기본 정보를<br />알려 주세요</h2> : <div className="text-sm font-semibold">기본 정보</div>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={cn(chip(sex === "female"), "h-12 text-base")} onClick={() => setSex("female")}>여자</button>
            <button type="button" className={cn(chip(sex === "male"), "h-12 text-base")} onClick={() => setSex("male")}>남자</button>
          </div>
          <label className="block text-sm text-muted-foreground">태어난 해<input inputMode="numeric" value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1985" className="mt-1 w-full h-12 rounded-xl border border-border bg-transparent px-4 text-lg text-foreground" /></label>
          <label className="block text-sm text-muted-foreground">키 (cm)<input inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} placeholder="162" className="mt-1 w-full h-12 rounded-xl border border-border bg-transparent px-4 text-lg text-foreground" /></label>
          <label className="block text-sm text-muted-foreground">몸무게 (kg)
            <input inputMode="decimal" value={weight} disabled={editing} onChange={e => setWeight(e.target.value)} placeholder="58.5" className="mt-1 w-full h-12 rounded-xl border border-border bg-transparent px-4 text-lg text-foreground disabled:opacity-60" />
          </label>
          <p className="text-xs text-muted-foreground text-center">몸무게는 시즌 시작·끝에 한 번씩 재요.{editing ? " 몸무게는 오늘 화면의 ‘체중 기록 추가’에서 바꿔요." : ""}</p>
        </section>
      )}

      {/* ③ 운동량 */}
      {show(2) && (
        <section className="space-y-4">
          {stepped ? <h2 className={big}>숨이 차고 땀이 날 정도의<br />운동을 얼마나 하세요?</h2> : <div className="text-sm font-semibold">숨이 차고 땀이 날 정도의 운동</div>}
          <div className="space-y-2">
            {([["low", "거의 안 해요", "주 1회 미만"], ["mid", "가끔 해요", "주 1~2회"], ["high", "자주 해요", "주 3회 이상"]] as const).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => setActivity(v)}
                className={cn("w-full rounded-2xl border px-5 py-4 text-left transition-colors", activity === v ? "border-primary bg-primary/15" : "border-border")}>
                <div className={cn("text-lg font-bold", activity === v && "text-primary")}>{t}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{d}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ④ 몸 상태 (선택) */}
      {show(3) && (
        <section className="space-y-4">
          {stepped ? <h2 className={big}>해당되는 게 있으면<br />골라 주세요</h2> : <div className="text-sm font-semibold">몸 상태 <span className="text-muted-foreground font-normal">(선택)</span></div>}
          <p className="text-xs text-muted-foreground text-center">없으면 그냥 넘어가도 돼요. 해당되면 앱 안내보다 의사 지침이 우선이에요.</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {sex === "female" && <>
              <button type="button" className={chip(pregnant)} onClick={() => setPregnant(!pregnant)}>임신 중</button>
              <button type="button" className={chip(lactating)} onClick={() => setLactating(!lactating)}>수유 중</button>
            </>}
            {FLAGS.map(f => <button key={f.id} type="button" className={chip(flags.includes(f.id))} onClick={() => setFlags(flags.includes(f.id) ? flags.filter(x => x !== f.id) : [...flags, f.id])}>{f.label}</button>)}
          </div>
          <div className="pt-2">
            <div className="text-sm font-semibold">방장에게 알려 주고 싶은 것 <span className="text-muted-foreground font-normal">(선택 · 방장만 봐요)</span></div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="질환·복용 약·수술처럼 챌린지에 영향을 줄 수 있는 것만요. 없으면 비워 두세요." className="mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50" />
            {note.trim() && (
              <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
                <span>이 내용을 안전한 챌린지 안내를 위해 방장이 보는 것에 동의해요. 언제든 고치거나 지울 수 있어요.</span>
              </label>
            )}
          </div>
        </section>
      )}

      {stepped && step < 3 ? (
        <div className="grid grid-cols-[auto_1fr] gap-2 pt-2">
          {step > 0 ? <Button variant="outline" className="h-12 rounded-full px-6" onClick={() => setStep(step - 1)}>이전</Button> : <span />}
          <Button className="h-12 rounded-full text-base glass-btn" onClick={() => { if (check(step)) setStep(step + 1); }}><span className="relative z-[1]">다음</span></Button>
        </div>
      ) : (
        <div className={cn("gap-2 pt-2", stepped ? "grid grid-cols-[auto_1fr]" : "")}>
          {stepped && <Button variant="outline" className="h-12 rounded-full px-6" onClick={() => setStep(step - 1)}>이전</Button>}
          <Button className="w-full h-12 rounded-full text-base glass-btn" onClick={() => { if ([0, 1, 2].every(check)) submit(); }} disabled={save.isPending}>
            <span className="relative z-[1]">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "저장하기" : "입력 완료하고 시작하기"}</span>
          </Button>
        </div>
      )}
      <p className="text-[11px] text-center text-muted-foreground">권장량은 「한국인 영양소 섭취기준」 등 공식 기준으로 계산한 참고 안내예요.</p>
    </div>
  );
}

/** 가입 후 필수 정보가 없으면 앱 대신 이 화면 */
export default function ProfileSetup({ children }: { children: React.ReactNode }) {
  // 2026-11-23: 한 번 실패(시간 초과 등)해도 동그라미에 갇히지 않게 2번 더 시도
  const me = trpc.wellness.myProfile.useQuery(undefined, { retry: 2, refetchOnWindowFocus: false });
  // 2026-11-22: 처음 정보를 다 넣으면 축하 화면 한 번
  const wasSetup = useRef(false);
  const [congrats, setCongrats] = useState(false);
  useEffect(() => {
    if (me.data?.needsSetup) wasSetup.current = true;
    else if (me.data && wasSetup.current) { wasSetup.current = false; setCongrats(true); }
  }, [me.data]);
  // 2026-11-22: 바탕화면 설치를 마쳐야 앱으로 (설치 전에 나갔다 와도 이 화면부터). 바탕화면 아이콘으로 열면 통과. 방장은 통과
  const { user: me2 } = useAuth();
  const inst = trpc.members.installStatus.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const markInstalled = trpc.members.markInstalled.useMutation({ onSuccess: () => { inst.refetch(); setCongrats(false); } });
  const standalone = typeof window !== "undefined" && isStandalone();
  useEffect(() => { if (standalone && inst.data && !inst.data.done) markInstalled.mutate(); }, [standalone, inst.data?.done]); // eslint-disable-line react-hooks/exhaustive-deps
  const needInstall = !standalone && me2?.role !== "admin" && inst.data && !inst.data.done && !me.data?.needsSetup && !me.isLoading;
  if (congrats || needInstall) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-5 season-fade-in">
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl font-black leading-snug">{congrats ? <>가입이 완료됐어요!<br /><span className="text-primary">축하합니다</span></> : <>바탕화면에<br /><span className="text-primary">설치해 주세요</span></>}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">이제부터 시작할 수 있어요.<br />나를 칭찬하는 순간, 우리 모두가 1등이 됩니다.</p>
          <p className="text-sm font-semibold">마지막 단계! 바탕화면에 설치하면 시작할 수 있어요.</p>
          <InstallButton onDone={() => markInstalled.mutate()} />
        </div>
      </div>
    );
  }
  if (me.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (me.data?.needsSetup) {
    return (
      <div className="min-h-screen bg-background px-5 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="editorial-eyebrow text-primary mb-1">WELCOME</div>
            <p className="text-xs text-muted-foreground">처음 한 번만 입력하면 돼요</p>
          </div>
          <ProfileForm />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
