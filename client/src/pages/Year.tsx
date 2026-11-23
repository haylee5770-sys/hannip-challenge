// 1년 — 3일 디톡스 달력 (2026-11-21 시안6): 유리 달 칸 + 클리어하면 블랙 유리 위에 왕관·달·MISSION CLEAR
// 미션 클리어 기준: 회차 3일 동안 매일 기상(수면) 인증 + 매일 식단 인증 (운동은 선택)
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
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

/** 시즌 결과 카드 (2026-11-22) */
function SeasonResult({ seasonId, onClose }: { seasonId: number; onClose: () => void }) {
  const q = trpc.rounds.mySeasonSummary.useQuery({ seasonId });
  const d = q.data;
  return (
    <div className="fixed inset-0 z-[110] bg-black/75 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl black-glass border border-primary p-6 space-y-4 season-fade-in" onClick={e => e.stopPropagation()}>
        {!d ? <div className="text-center text-sm text-muted-foreground py-6">불러오는 중…</div> : (<>
          <div className="text-center">
            <div className="text-xs text-primary font-bold tracking-widest">SEASON RESULT</div>
            <div className="text-xl font-black mt-1">{d.season.name}</div>
            <div className="text-xs text-muted-foreground">{md(d.season.startDate)} ~ {d.season.planEnd ? md(d.season.planEnd) : ""}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["인증", d.counts.total], ["이게돼", d.counts.itge], ["운동", d.counts.exercise]] as const).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/[0.05] py-3"><div className="text-2xl font-black text-primary">{v}</div><div className="text-[11px] text-muted-foreground">{k}</div></div>
            ))}
          </div>
          <div className="text-center text-sm">체중 {d.weightStart ?? "-"} → {d.weightEnd ?? "-"}kg
            {d.weightStart != null && d.weightEnd != null && <b className="text-primary"> ({(d.weightEnd - d.weightStart >= 0 ? "+" : "") + (d.weightEnd - d.weightStart).toFixed(1)})</b>}</div>
          <button type="button" onClick={onClose} className="w-full rounded-2xl glass-btn py-3 font-bold">닫기</button>
        </>)}
      </div>
    </div>
  );
}

/** 2026 파이널 시즌 — 8칸 밖 보너스 시즌 카드 (2026-11-22) */
const FINAL_2026 = { start: "2026-11-24", end: "2026-12-23" };
function Final2026({ past }: { past?: boolean }) {
  const [, navigate] = useLocation();
  const seasons = trpc.rounds.allSeasons.useQuery();
  const [open, setOpen] = useState<number | null>(null);
  // 2026-11-24: '테스트 시즌'은 파이널 시즌으로 착각하지 않게 뺀다
  const s = (seasons.data ?? []).find(x => x.startDate >= "2026-11-20" && x.startDate < "2027-01-01" && !String(x.name).startsWith("테스트 시즌"));
  const today = todayKst();
  const state = s ? (s.status === "active" ? "live" : "done") : today < FINAL_2026.start ? "planned" : "planned";
  const click = () => {
    if (state === "live") navigate("/dashboard");
    else if (state === "done" && s) setOpen(s.id);
    else toast("아직 시작 전인 시즌이에요. 11월 24일에 열려요!");
  };
  return (
    <section className="space-y-2">
      {past && <div className="text-xs text-muted-foreground font-semibold pt-4">지난 시즌 · 2026</div>}
      <button type="button" onClick={click} className="w-full text-left rounded-3xl border border-primary/40 bg-primary/10 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide text-primary">BONUS SEASON</span>
          <span className="text-[11px] text-muted-foreground">{state === "live" ? "진행 중 · 누르면 나의 변화" : state === "done" ? "끝 · 누르면 결과" : "11/24 시작"}</span>
        </div>
        <div className="text-2xl font-black mt-1">2026 파이널 시즌</div>
        <div className="text-xs text-muted-foreground mt-0.5">{md(FINAL_2026.start)} ~ {md(FINAL_2026.end)} · 매일 루틴 참여</div>
      </button>
      {open && <SeasonResult seasonId={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** 테스트 시즌 카드 (2026-11-24 해이): 파이널 시즌 카드 위, 같은 너비. 누르면 기록 보기. 나중에 해이가 '삭제해 줘' 하면 지움 */
function TestSeasonCards() {
  const [, navigate] = useLocation();
  const seasons = trpc.rounds.allSeasons.useQuery();
  const [open, setOpen] = useState<number | null>(null);
  const tests = (seasons.data ?? []).filter(x => String(x.name).startsWith("테스트 시즌"));
  if (!tests.length) return null;
  return (
    <section className="space-y-2">
      {tests.map(t => (
        <button key={t.id} type="button" onClick={() => (t.status === "active" ? navigate("/dashboard") : setOpen(t.id))}
          className="w-full text-left rounded-3xl border border-dashed border-amber-400/60 bg-amber-400/5 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold tracking-wide text-amber-200">TEST SEASON</span>
            <span className="text-[11px] text-muted-foreground">{t.status === "active" ? "진행 중 · 누르면 나의 변화" : "끝 · 누르면 결과"}</span>
          </div>
          <div className="text-2xl font-black mt-1">테스트 시즌</div>
          <div className="text-xs text-muted-foreground mt-0.5">{md(t.startDate)} · <span className="text-amber-200">삭제될 예정</span></div>
        </button>
      ))}
      {open && <SeasonResult seasonId={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function YearHead({ year, line1, line2 }: { year: string; line1: string; line2: string }) {
  // 2026-11-22: 왼쪽 큰 연도(포인트색) + 오른쪽 흰 글씨 두 줄
  return (
    <div className="flex items-center gap-3 pt-2 pb-1 px-1">
      <span className="text-5xl font-black text-primary leading-none tabular-nums">{year}</span>
      <span className="text-base font-semibold leading-snug text-foreground">{line1}<br />{line2}</span>
    </div>
  );
}

export default function Year() {
  const [, navigate] = useLocation();
  const seasonsAll = trpc.rounds.allSeasons.useQuery();
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const isNewYear = todayKst() >= `${YEAR}-01-01`;
  const tapMonth = (m: number) => {
    const s = (seasonsAll.data ?? []).find(x => x.startDate.startsWith(`${YEAR}-${pad(m)}`));
    if (s?.status === "active") return navigate("/dashboard");
    if (s) return setOpenSeason(s.id);
    toast(todayKst() < `${YEAR}-${pad(m)}-01` ? "아직 진행 전인 달이에요. 시즌이 시작되면 열려요!" : "이 달에는 시즌 기록이 없어요.");
  };
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
      {!isNewYear && (<>
        <YearHead year="2026" line1="나의" line2="마지막 시즌" />
        <TestSeasonCards />
        <Final2026 />
        <div className="pt-6" />
      </>)}
      <YearHead year={String(YEAR)} line1="나의 1년," line2="8번의 시즌" />

      {/* 진행 카드 — 블랙 유리 */}
      <section className="rounded-3xl border border-primary/40 bg-primary/10 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">MISSION CLEAR</span>
          <span className="text-sm font-extrabold text-primary">{Math.round((clearCount / ROUNDS.length) * 100)}%</span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-4xl font-black leading-none">{clearCount}<span className="text-base text-muted-foreground font-bold"> / {ROUNDS.length}시즌</span></span>
          {next && <span className="text-[11px] text-muted-foreground">{next.status === "live" ? `시즌 ${next.no} 디톡스 진행 중 ${next.done}/3` : `다음 시즌 ${md(next.days[0])}`}</span>}
        </div>
        <div className="grid grid-cols-8 gap-1 mt-3">
          {rounds.map(r => (
            <div key={r.no} className={cn("h-10 rounded-xl border flex flex-col items-center justify-center", r.status === "clear" ? "glass-fill" : "border-white/10 bg-white/[0.04]")}>
              <span className={cn("text-base leading-none", r.status !== "clear" && "grayscale opacity-30")}>👑</span>
              <span className="text-[9px] mt-0.5 opacity-80">S{r.no}</span>
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
            <div key={m} onClick={() => tapMonth(m)} className="month-glass relative rounded-2xl border-[0.5px] border-primary/35 p-2 overflow-hidden cursor-pointer active:scale-[0.98] transition">
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
      {isNewYear && <Final2026 past />}
      {openSeason && <SeasonResult seasonId={openSeason} onClose={() => setOpenSeason(null)} />}
    </div>
  );
}
