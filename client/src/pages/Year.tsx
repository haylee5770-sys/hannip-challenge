// 1년 — 3일 디톡스 달력 (2026-11-21 시안6): 유리 달 칸 + 클리어하면 블랙 유리 위에 왕관·달·MISSION CLEAR
// 미션 클리어 기준: 회차 3일 동안 매일 기상(수면) 인증 + 매일 식단 인증 (운동은 선택)
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import PageTitle from "@/components/PageTitle";

const YEAR = 2027;
const ROUNDS = ["01-12", "02-23", "04-06", "05-25", "07-13", "09-01", "10-19", "11-30"];
const HOL = new Set(["01-01", "02-06", "02-07", "02-08", "02-09", "03-01", "05-05", "05-13", "06-06", "08-15", "08-16", "09-14", "09-15", "09-16", "10-03", "10-04", "10-09", "10-11", "12-25", "12-27"]);
const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const md = (d: string) => { const [, m, dd] = d.split("-").map(Number); return `${m}/${dd}`; };
const W = ["일", "월", "화", "수", "목", "금", "토"];

export default function Year() {
  const flags = trpc.rounds.dayFlags.useQuery({ since: `${YEAR}-01-01`, until: `${YEAR}-12-31` });
  const rounds = useMemo(() => ROUNDS.map((m, i) => {
    const start = `${YEAR}-${m}`;
    const days = [0, 1, 2].map(k => addDays(start, k));
    const wake = new Set(flags.data?.wake ?? []), meal = new Set(flags.data?.meal ?? []);
    const done = days.filter(d => wake.has(d) && meal.has(d)).length;
    const today = todayKst();
    const status = done === 3 ? "clear" : today < days[0] ? "planned" : today <= days[2] ? "live" : "missed";
    return { no: i + 1, days, done, status };
  }), [flags.data]);
  const dayRound = new Map<string, number>();
  rounds.forEach(r => r.days.forEach(d => dayRound.set(d.slice(5), r.no)));
  const clearCount = rounds.filter(r => r.status === "clear").length;
  const next = rounds.find(r => r.status === "planned" || r.status === "live");
  // 달마다 클리어한 회차 (그 달에 시작한 회차 기준)
  const clearByMonth = new Map<number, typeof rounds[number]>();
  rounds.forEach(r => { if (r.status === "clear") clearByMonth.set(Number(r.days[0].slice(5, 7)), r); });
  const liveByMonth = new Map<number, typeof rounds[number]>();
  rounds.forEach(r => { if (r.status === "live") liveByMonth.set(Number(r.days[0].slice(5, 7)), r); });

  return (
    <div className="space-y-4">
      <PageTitle eyebrow={`MY YEAR · ${YEAR}`} title="나의 1년, 3일 디톡스" />

      {/* 진행 카드 — 블랙 유리 */}
      <section className="black-glass rounded-3xl border border-primary p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">MISSION CLEAR</span>
          <span className="text-sm font-extrabold text-primary">{Math.round((clearCount / ROUNDS.length) * 100)}%</span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-4xl font-black leading-none">{clearCount}<span className="text-base text-muted-foreground font-bold"> / {ROUNDS.length}회</span></span>
          {next && <span className="text-[11px] text-muted-foreground">{next.status === "live" ? `${next.no}회 진행 중 ${next.done}/3` : `다음 회차 ${md(next.days[0])}`}</span>}
        </div>
        <div className="grid grid-cols-8 gap-1 mt-3">
          {rounds.map(r => (
            <div key={r.no} className={cn("h-10 rounded-xl border flex flex-col items-center justify-center", r.status === "clear" ? "glass-fill" : "border-white/10 bg-white/[0.04]")}>
              <span className={cn("text-base leading-none", r.status !== "clear" && "grayscale opacity-30")}>👑</span>
              <span className="text-[9px] mt-0.5 opacity-80">{r.no}회</span>
            </div>
          ))}
        </div>
      </section>

      {/* 12달 달력 — 유리 칸, 얇은 테두리는 모두 같음 */}
      <section className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, mi) => {
          const m = mi + 1;
          const first = new Date(Date.UTC(YEAR, mi, 1)).getUTCDay();
          const last = new Date(Date.UTC(YEAR, mi + 1, 0)).getUTCDate();
          const clr = clearByMonth.get(m);
          const live = liveByMonth.get(m);
          const startHere = rounds.find(r => Number(r.days[0].slice(5, 7)) === m);
          return (
            <div key={m} className="month-glass relative rounded-2xl border border-primary/70 p-2 overflow-hidden">
              <div className={cn(clr && "opacity-20")}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-extrabold">{m}월</span>
                  {live ? <span className="text-[9px] font-bold text-primary">진행 중 {live.done}/3</span>
                    : startHere && !clr ? <span className="text-[9px] font-bold text-primary">{Number(startHere.days[0].slice(8))}일~</span> : null}
                </div>
                <div className="grid grid-cols-7 gap-px text-[9px] text-center">
                  {W.map((w, i) => <div key={w} className={cn("text-muted-foreground", (i === 0 || i === 6) && "text-sky-300/80")}>{w}</div>)}
                  {Array.from({ length: first }, (_, i) => <div key={"e" + i} />)}
                  {Array.from({ length: last }, (_, i) => {
                    const k = `${pad(m)}-${pad(i + 1)}`;
                    const dow = (first + i) % 7;
                    return (
                      <div key={k} className={cn("rounded py-0.5 tabular-nums",
                        dayRound.has(k) ? "bg-primary/45 text-white font-extrabold"
                          : HOL.has(k) ? "bg-rose-500/25 text-rose-200" : (dow === 0 || dow === 6) ? "text-sky-300/80" : "")}>
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
              {clr && (
                <div className="clear-cover absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="absolute top-2 inset-x-0 text-[10px] text-zinc-400 font-semibold">{md(clr.days[0])} ~ {md(clr.days[2])}</span>
                  <span className="text-3xl leading-none">👑</span>
                  <span className="text-lg font-black mt-1">{m}월</span>
                  <span className="text-[10px] font-black tracking-[0.12em] text-primary mt-0.5">MISSION CLEAR</span>
                </div>
              )}
            </div>
          );
        })}
      </section>
      <div className="flex justify-center gap-4 text-[11px] text-muted-foreground">
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/45 mr-1 align-[-1px]" />디톡스 데이</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm border border-sky-300/80 mr-1 align-[-1px]" />주말</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500/30 mr-1 align-[-1px]" />공휴일</span>
      </div>
    </div>
  );
}
