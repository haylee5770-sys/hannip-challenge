// 1년 — 3일 디톡스 달력 + 미션 클리어 왕관 (2026-11-20)
// 미션 클리어 기준: 회차 3일 동안 매일 기상(수면) 인증 + 매일 식단 인증 (운동은 선택)
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const YEAR = 2027;
const ROUNDS = ["01-12", "02-23", "04-06", "05-25", "07-13", "09-01", "10-19", "11-30"];
const HOL = new Set(["01-01", "02-06", "02-07", "02-08", "02-09", "03-01", "05-05", "05-13", "06-06", "08-15", "08-16", "09-14", "09-15", "09-16", "10-03", "10-04", "10-09", "10-11", "12-25", "12-27"]);
const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export default function Year() {
  const flags = trpc.rounds.dayFlags.useQuery({ since: `${YEAR}-01-01`, until: `${YEAR}-12-31` });
  const rounds = useMemo(() => ROUNDS.map((md, i) => {
    const start = `${YEAR}-${md}`;
    const days = [0, 1, 2].map(k => addDays(start, k));
    const wake = new Set(flags.data?.wake ?? []), meal = new Set(flags.data?.meal ?? []);
    const done = days.filter(d => wake.has(d) && meal.has(d)).length;
    const today = todayKst();
    const status = done === 3 ? "clear" : today < days[0] ? "planned" : today <= days[2] ? "live" : "missed";
    return { no: i + 1, days, done, status };
  }), [flags.data]);
  const dx = new Map<string, number>();
  rounds.forEach(r => r.days.forEach(d => dx.set(d.slice(5), r.no)));
  const clearCount = rounds.filter(r => r.status === "clear").length;

  return (
    <div>
      <section className="pb-4 text-center">
        <div className="editorial-eyebrow text-primary mb-1">MY YEAR · {YEAR}</div>
        <h1 className="text-3xl md:text-4xl font-semibold">나의 1년, 3일 디톡스</h1>
        <p className="mt-2 text-sm text-muted-foreground">회차 3일 동안 <b className="text-foreground">매일 기상 인증 + 식단 인증</b>을 하면 왕관을 받아요.</p>
        <p className="mt-1 text-sm">👑 <b className="text-primary">{clearCount}</b> / {ROUNDS.length} 미션 클리어</p>
      </section>

      {/* 회차 메달 */}
      <section className="mb-5 grid grid-cols-4 gap-2">
        {rounds.map(r => {
          const [m, d] = r.days[0].slice(5).split("-").map(Number);
          const end = r.days[2].slice(5).split("-").map(Number);
          return (
            <div key={r.no} className={cn("rounded-2xl border p-2 text-center",
              r.status === "clear" ? "border-primary bg-primary/15" : r.status === "live" ? "border-primary/60" : "border-border bg-card")}>
              <div className="text-xl leading-none">{r.status === "clear" ? "👑" : r.status === "live" ? "🔥" : r.status === "missed" ? "·" : "○"}</div>
              <div className="text-xs font-semibold mt-1">{r.no}회</div>
              <div className="text-[11px] text-muted-foreground tabular-nums">{m}/{d}~{end[0]}/{end[1]}</div>
              <div className={cn("text-[10px] mt-0.5 font-semibold", r.status === "clear" ? "text-primary" : "text-muted-foreground")}>
                {r.status === "clear" ? "MISSION CLEAR" : r.status === "live" ? `진행 중 ${r.done}/3` : r.status === "missed" ? `${r.done}/3` : "예정"}
              </div>
            </div>
          );
        })}
      </section>

      {/* 12달 달력 */}
      <section className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, m) => {
          const first = new Date(Date.UTC(YEAR, m, 1)).getUTCDay();
          const last = new Date(Date.UTC(YEAR, m + 1, 0)).getUTCDate();
          return (
            <div key={m} className="rounded-xl bg-card border border-border p-2">
              <div className="text-sm font-bold mb-1">{m + 1}월</div>
              <div className="grid grid-cols-7 gap-px text-[9px] text-center">
                {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => <div key={w} className={cn("text-muted-foreground", i === 0 && "text-rose-400", i === 6 && "text-sky-400")}>{w}</div>)}
                {Array.from({ length: first }, (_, i) => <div key={"e" + i} />)}
                {Array.from({ length: last }, (_, i) => {
                  const k = `${pad(m + 1)}-${pad(i + 1)}`;
                  const no = dx.get(k);
                  const r = no ? rounds[no - 1] : null;
                  const dow = (first + i) % 7;
                  return (
                    <div key={k} className={cn("rounded-sm py-0.5 tabular-nums",
                      no ? (r?.status === "clear" ? "bg-primary text-primary-foreground font-bold" : "bg-primary/35 text-foreground font-semibold")
                        : HOL.has(k) ? "bg-rose-500/25 text-rose-300" : dow === 0 ? "text-rose-400" : dow === 6 ? "text-sky-400" : "")}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">초록 = 디톡스 날 · 빨강 = 공휴일 · 진한 초록 = 클리어</p>
    </div>
  );
}
