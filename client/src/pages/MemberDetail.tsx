// 멤버 상세 (2026-11-21) — 방장과 본인만. 기본 정보 · 몸 상태 · 최근 14일 컨디션·식단·운동·수면·물 · 몸무게 변화
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft } from "lucide-react";

const COND: Record<string, string> = { best: "😆 최상", ok: "🙂 괜찮음", meh: "😐 그저 그럼", tired: "😩 힘이 없음" };
const MOOD: Record<number, string> = { 4: "😊", 3: "🙂", 2: "😐", 1: "😔" };
const FEEL: Record<string, string> = { easy: "편안", ok: "적당", max: "숨이 턱끝까지" };
const ACT: Record<string, string> = { low: "주로 앉아서", mid: "많이 걷거나 서서", high: "몸 쓰는 일" };
const FLAG: Record<string, string> = { diabetes: "당뇨·혈당약", kidney: "신장 질환", thyroid: "갑상선", eating: "섭식장애", heart: "심장·혈압·수술·부상", doctor: "의사 제한" };

export default function MemberDetail() {
  const [, params] = useRoute("/member/:id");
  const id = Number(params?.id);
  const q = trpc.wellness.memberDetail.useQuery({ userId: id }, { enabled: !!id, retry: false });
  if (q.isLoading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (q.error) return <p className="py-20 text-center text-muted-foreground">{q.error.message}</p>;
  const d = q.data!;
  const p = d.profile;
  const ws = d.weights;
  return (
    <div className="space-y-4">
      <Link href="/members" className="inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> 멤버</Link>
      <section className="rounded-2xl bg-card border border-border p-4">
        <h1 className="text-2xl font-semibold">{d.user?.name} {d.user?.realName ? <span className="text-sm text-muted-foreground">({d.user.realName})</span> : null}</h1>
        {d.summary.length > 0 && <div className="mt-2 space-y-1">{d.summary.map((s, i) => <div key={i} className="text-sm text-rose-300">⚠️ {s}</div>)}</div>}
        {p ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>성별 <b>{p.sex === "male" ? "남" : "여"}</b></div>
            <div>나이 <b>{d.age}세</b></div>
            <div>키 <b>{p.heightCm}cm</b></div>
            <div>최근 몸무게 <b>{d.latestWeight ?? "-"}kg</b></div>
            <div>BMI <b>{d.bmi ?? "-"}</b>{d.bmi != null && d.bmi < 18.5 ? <span className="text-rose-300"> 저체중</span> : null}</div>
            <div>활동량 <b>{ACT[p.activity]}</b></div>
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">아직 몸 정보를 입력하지 않았어요.</p>}
        {p && (p.pregnant || p.lactating || p.flags.length > 0) && (
          <div className="mt-3 text-sm"><span className="text-muted-foreground">몸 상태 체크: </span>
            {[p.pregnant ? "임신 중" : null, p.lactating ? "수유 중" : null, ...p.flags.map(f => FLAG[f])].filter(Boolean).join(" · ")}</div>
        )}
        {p?.healthNote && <div className="mt-2 text-sm rounded-lg bg-background/50 p-2"><span className="text-muted-foreground">방장에게 남긴 메모: </span>{p.healthNote}</div>}
      </section>

      {ws.length > 0 && (
        <section className="rounded-2xl bg-card border border-border p-4">
          <h2 className="font-semibold mb-2">몸무게 변화</h2>
          <div className="flex flex-wrap gap-2 text-sm">{ws.map(w => <span key={w.date} className="px-2 py-1 rounded-lg bg-background/50">{w.date.slice(5)} <b>{w.kg}</b>kg</span>)}</div>
        </section>
      )}

      <section className="rounded-2xl bg-card border border-border p-4">
        <h2 className="font-semibold mb-2">최근 14일</h2>
        <div className="divide-y divide-border">
          {d.days.map(r => (
            <div key={r.date} className="py-2 text-sm space-y-0.5">
              <div className="flex items-center gap-2"><b className="w-12">{r.date.slice(5)}</b>
                <span>{r.condition ? COND[r.condition] : <span className="text-muted-foreground">컨디션 -</span>}</span>
                {r.mood ? <span>마음 {MOOD[r.mood] ?? ""}</span> : null}
              </div>
              <div className="pl-14 text-muted-foreground">
                {r.meals ? <>식단 {r.meals.n}회 · 탄{r.meals.carbsG} 단{r.meals.proteinG} 지{r.meals.fatG}{r.meals.pct != null && <b className={r.meals.pct < 70 ? " text-rose-300" : r.meals.pct > 120 ? " text-amber-200" : " text-primary"}> 권장량 {r.meals.pct}%</b>}</> : "식단 -"}
                {" · "}{r.sleepMin != null ? `수면 ${Math.floor(r.sleepMin / 60)}시간${r.sleepMin % 60 ? ` ${r.sleepMin % 60}분` : ""}` : "수면 -"}
                {" · "}{r.waterMl != null ? `물 ${r.waterMl}ml` : "물 -"}
              </div>
              {(r.exercises as Array<{ kind: string; min: number; km: number | null; feel: string | null; sweat: boolean; comment: string | null }>).map((e, i) => (
                <div key={i} className="pl-14 text-muted-foreground">운동 {e.kind} {e.min}분{e.km ? ` · ${e.km}km` : ""}{e.feel ? ` · ${FEEL[e.feel] ?? ""}` : ""}{e.sweat ? " · 땀 폭발" : ""}{e.comment ? <div className="text-foreground/80">{e.comment}</div> : null}</div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
