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
    if (!activity) return toast.error("평소 활동량을 골라 주세요.");
    if (note.trim() && !consent) return toast.error("몸 상태 메모를 저장하려면 동의에 체크해 주세요.");
    save.mutate({
      avatarBase64: avatar ?? undefined, sex, birthYear: by, heightCm: h, weightKg: w && w >= 30 && w <= 250 ? w : undefined, activity,
      pregnant: sex === "female" && pregnant, lactating: sex === "female" && lactating, flags: flags as any,
      healthNote: consent ? note.trim() || null : null, healthConsent: consent,
    });
  };

  if (me.isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* 프로필 사진 */}
      <section className="space-y-2">
        <div className="text-sm font-semibold">프로필 사진 <span className="text-primary">(필수)</span></div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-[28%] overflow-hidden border border-primary/70 hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
            {shownAvatar ? <img src={shownAvatar} alt="" className="w-full h-full object-cover" /> : <Camera className="h-6 w-6 text-primary" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setAvatar(await squareDataUrl(f)); }} />
          <p className="text-xs leading-relaxed text-rose-300 break-keep">⚠️ <b>카톡방 프로필 사진과 똑같은 사진을 넣어 주세요.</b><br />이 사진이 같아야 누가 올렸는지 매칭돼요.</p>
        </div>
      </section>

      {/* 기본 정보 */}
      <section className="space-y-3">
        <div>
          <div className="text-sm font-semibold">기본 정보 <span className="text-primary">(필수)</span></div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">키, 몸무게는 처음 가입 당시 기록이 필수입니다.<br />몸무게는 <b className="text-foreground">시즌이 시작할 때와 끝날 때</b> 한 번씩 잽니다.{editing ? " 몸무게는 오늘 화면의 \u0027체중 기록 추가\u0027에서 바꿔요." : ""}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={chip(sex === "female")} onClick={() => setSex("female")}>여자</button>
          <button type="button" className={chip(sex === "male")} onClick={() => setSex("male")}>남자</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[11px] text-muted-foreground">태어난 해<input inputMode="numeric" value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1985" className="mt-1 w-full h-11 rounded-xl border border-border bg-transparent px-3 text-base text-foreground" /></label>
          <label className="text-[11px] text-muted-foreground">키 (cm)<input inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} placeholder="162" className="mt-1 w-full h-11 rounded-xl border border-border bg-transparent px-3 text-base text-foreground" /></label>
          <label className="text-[11px] text-muted-foreground">몸무게 (kg)
            <input inputMode="decimal" value={weight} disabled={editing} onChange={e => setWeight(e.target.value)} placeholder="58.5" className="mt-1 w-full h-11 rounded-xl border border-border bg-transparent px-3 text-base text-foreground disabled:opacity-60" />
          </label>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">평소 활동량 (운동 말고 일상)</div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={chip(activity === "low")} onClick={() => setActivity("low")}>주로 앉아서</button>
            <button type="button" className={chip(activity === "mid")} onClick={() => setActivity("mid")}>서서·많이 걸음</button>
            <button type="button" className={chip(activity === "high")} onClick={() => setActivity("high")}>몸 쓰는 일</button>
          </div>
        </div>
      </section>

      {/* 선택: 몸 상태 */}
      <section className="space-y-3 rounded-2xl border border-border p-4">
        <div>
          <div className="text-sm font-semibold">몸 상태 <span className="text-muted-foreground font-normal">(선택 · 해당되면 체크)</span></div>
          <p className="text-[11px] text-muted-foreground mt-0.5">체크하면 앱 안내가 몸 상태에 맞게 바뀌어요. 이 경우 앱 안내보다 의사·전문가 지침이 우선이에요.</p>
        </div>
        {sex === "female" && (
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={chip(pregnant)} onClick={() => setPregnant(!pregnant)}>임신 중</button>
            <button type="button" className={chip(lactating)} onClick={() => setLactating(!lactating)}>수유 중</button>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {FLAGS.map(f => <button key={f.id} type="button" className={chip(flags.includes(f.id))} onClick={() => setFlags(flags.includes(f.id) ? flags.filter(x => x !== f.id) : [...flags, f.id])}>{f.label}</button>)}
        </div>
        <div className="pt-1">
          <div className="text-sm font-semibold">방장에게 알려 주고 싶은 몸 상태 <span className="text-muted-foreground font-normal">(선택)</span></div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">지금 앓고 있는 질환, 복용 중인 약, 수술·부상 등 <b className="text-foreground">챌린지에 영향을 줄 수 있는 중요한 사항</b>만 적어 주세요. 가벼운 감기나 피로 같은 소소한 건 적지 않아도 돼요. 적어 주신 내용은 <b className="text-foreground">방장만</b> 볼 수 있어요.</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="특별히 없으면 '없음'이라고 적거나 비워 두셔도 괜찮아요." className="mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50" />
          <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
            <span>위 몸 상태 정보(건강 정보)를 안전한 챌린지 안내를 위해 방장이 보는 것에 동의합니다. 언제든 고치거나 지울 수 있어요.</span>
          </label>
        </div>
      </section>

      <Button className="w-full h-12 rounded-xl text-base" onClick={submit} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "저장하기" : "입력 완료하고 시작하기"}
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">권장량은 「한국인 영양소 섭취기준」 등 공식 기준으로 계산한 참고 안내예요.</p>
    </div>
  );
}

/** 가입 후 필수 정보가 없으면 앱 대신 이 화면 */
export default function ProfileSetup({ children }: { children: React.ReactNode }) {
  const me = trpc.wellness.myProfile.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
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
            <h1 className="text-2xl font-semibold">처음 한 번만 입력해 주세요</h1>
            <p className="text-sm text-muted-foreground mt-1">내 몸에 맞는 하루 권장량과 운동 안내를 위해 필요해요.</p>
          </div>
          <ProfileForm />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
