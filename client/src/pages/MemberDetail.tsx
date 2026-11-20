// 멤버 상세 (2026-11-21) — 방장과 본인만. 기본 정보 · 몸 상태 · 최근 14일 컨디션·식단·운동·수면·물 · 몸무게 변화
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const COND: Record<string, string> = { best: "😆 최상", ok: "🙂 괜찮음", meh: "😐 그저 그럼", tired: "😩 힘이 없음" };
const MOOD: Record<number, string> = { 4: "😊", 3: "🙂", 2: "😐", 1: "😔" };
const FEEL: Record<string, string> = { easy: "편안", ok: "적당", max: "숨이 턱끝까지" };
const ACT: Record<string, string> = { low: "주로 앉아서", mid: "많이 걷거나 서서", high: "몸 쓰는 일" };
const FLAG: Record<string, string> = { diabetes: "당뇨·혈당약", kidney: "신장 질환", thyroid: "갑상선", eating: "섭식장애", heart: "심장·혈압·수술·부상", doctor: "의사 제한" };

export default function MemberDetail() {
  const [, params] = useRoute("/member/:id");
  // 주소에서 번호를 못 읽는 경우가 있어 주소창에서 한 번 더 읽는다 (2026-11-21 오류 고침)
  const id = Number(params?.id ?? window.location.pathname.match(/\/member\/(\d+)/)?.[1]);
  const q = trpc.wellness.memberDetail.useQuery({ userId: id }, { enabled: Number.isFinite(id) && id > 0, retry: false });
  if (q.error) return <p className="py-20 text-center text-muted-foreground">{q.error.message}</p>;
  if (!q.data) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const d = q.data;
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
          <WeightChart data={ws.map(w => ({ date: String(w.date), kg: Number(w.kg) }))} />
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

/** 몸무게 변화 가로 그래프 (2026-11-21, 인바디 참고): 점 위에 kg, 아래에 날짜 항상 */
function WeightChart({ data }: { data: Array<{ date: string; kg: number }> }) {
  const pts = data.filter(d => Number.isFinite(d.kg));
  const [sel, setSel] = useState(pts.length - 1);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [pts.length]);
  if (!pts.length) return null;
  const STEP = 64, PADX = 32, TOP = 34, H = 150, BOTTOM = 30;
  const w = Math.max(320, PADX * 2 + STEP * (pts.length - 1));
  const kgs = pts.map(p => p.kg);
  let lo = Math.min(...kgs), hi = Math.max(...kgs);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const x = (i: number) => pts.length === 1 ? w / 2 : PADX + i * ((w - PADX * 2) / (pts.length - 1));
  const y = (kg: number) => TOP + (hi - kg) / (hi - lo) * (H - TOP - BOTTOM);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.kg)}`).join(" ");
  const first = pts[0].kg, last = pts[pts.length - 1].kg, diff = Math.round((last - first) * 10) / 10;
  const md = (d: string) => { const [, m, dd] = d.slice(0, 10).split("-"); return `${Number(m)}/${Number(dd)}`; };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold">몸무게 변화</h2>
      </div>
      <div className="text-xs text-muted-foreground mb-1">
        처음 {first}kg → 지금 <b className="text-foreground">{last}kg</b>
        {pts.length > 1 && <span className={diff < 0 ? "text-primary ml-1" : diff > 0 ? "text-rose-300 ml-1" : "ml-1"}>({diff > 0 ? "+" : ""}{diff}kg)</span>}
      </div>
      <div ref={scroller} className="overflow-x-auto -mx-1">
        <svg width={w} height={H} className="block">
          <line x1={PADX - 16} x2={w - PADX + 16} y1={H - BOTTOM + 8} y2={H - BOTTOM + 8} stroke="rgba(255,255,255,0.12)" />
          {pts.length > 1 && <path d={path} fill="none" stroke="var(--primary)" strokeOpacity={0.7} strokeWidth={2} />}
          {pts.map((p, i) => {
            const on = i === sel;
            return (
              <g key={p.date + i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <rect x={x(i) - STEP / 2} y={0} width={STEP} height={H} fill="transparent" />
                <text x={x(i)} y={y(p.kg) - 12} textAnchor="middle" fontSize={on ? 13 : 11} fontWeight={on ? 700 : 400} fill={on ? "var(--primary)" : "rgba(255,255,255,0.7)"}>{p.kg}</text>
                <circle cx={x(i)} cy={y(p.kg)} r={on ? 7 : 5} fill={on ? "var(--primary)" : "#2b2d30"} stroke="var(--primary)" strokeWidth={2} />
                {<text x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill={on ? "var(--primary)" : "rgba(255,255,255,0.55)"}>{md(p.date)}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
