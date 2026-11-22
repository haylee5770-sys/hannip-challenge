// 시즌 시작 화면 (2026-11-22): 방장이 시즌을 시작하면 모든 크루가 앱을 열 때 먼저 본다.
// "새로운 시즌이 시작되었습니다" 글자가 한 글자씩 스르륵 → 참여 버튼(유리) 1~2개 → 고르면 '오늘'로
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const md = (d: string | null) => (d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : "");
const addDay = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);

function Letters({ text, delay = 0 }: { text: string; delay?: number }) {
  return <>{Array.from(text).map((ch, i) => <span key={i} className="season-letter" style={{ animationDelay: `${delay + i * 0.06}s` }}>{ch === " " ? " " : ch}</span>)}</>;
}

type SeasonLite = { name: string; startDate: string; planEnd: string | null; detoxStart?: string | null; detoxEnd?: string | null };

/** 화면만 (실제 시작·미리보기 둘 다 씀) */
export function SeasonScreen({ s, onPick, pending, picked, note }: { s: SeasonLite; onPick: (t: "detox" | "routine") => void; pending?: boolean; picked?: string | null; note?: React.ReactNode }) {
  const hasDetox = !!(s.detoxStart && s.detoxEnd);
  const routineFrom = hasDetox ? addDay(s.detoxEnd!, 1) : s.startDate;
  const btn = "w-full rounded-3xl border border-white/20 bg-white/[0.06] backdrop-blur-xl px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_30px_rgba(0,0,0,0.35)] active:scale-[0.98] transition disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-[90] bg-background flex items-center justify-center px-6 overflow-y-auto">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
      <div className="relative max-w-sm w-full py-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="text-xs tracking-[0.3em] text-primary font-bold season-fade-in">NEW SEASON</div>
          <h1 className="text-[28px] leading-snug font-black season-glow">
            <Letters text="새로운 시즌이" /><br /><Letters text="시작되었습니다" delay={0.5} />
          </h1>
          <p className="text-base font-semibold text-primary season-fade-in" style={{ animationDelay: "1.3s" }}>{s.name}</p>
          <p className="text-sm text-muted-foreground season-fade-in" style={{ animationDelay: "1.5s" }}>어떤 챌린지에 참여하시겠어요?</p>
        </div>

        <div className="space-y-3 season-fade-in" style={{ animationDelay: "1.8s" }}>
          {hasDetox && (
            <button type="button" className={btn} disabled={pending} onClick={() => onPick("detox")}>
              <div className="text-xl font-black">3일 디톡스</div>
              <div className="text-xs text-muted-foreground mt-1">{md(s.detoxStart ?? null)} ~ {md(s.detoxEnd ?? null)} 디톡스 참여</div>
              {picked === "detox" && pending && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
            </button>
          )}
          <button type="button" className={btn + " border-primary/60"} disabled={pending} onClick={() => onPick("routine")}>
            <div className="text-xl font-black">{hasDetox ? s.name : `${s.name} 참여하기`} <span className="text-base">🏆</span></div>
            {hasDetox && <div className="text-xs text-muted-foreground mt-1">{md(s.detoxStart ?? null)} ~ {md(s.detoxEnd ?? null)} 디톡스 참여</div>}
            <div className="text-xs text-muted-foreground mt-0.5">{md(routineFrom)} ~ {md(s.planEnd)} 매일 루틴 참여</div>
            <div className="text-[11px] text-primary mt-1">시상식 대상이에요</div>
            {picked === "routine" && pending && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
          </button>
        </div>
        {note}
      </div>
    </div>
  );
}

export default function SeasonStart({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const q = trpc.rounds.myEntry.useQuery(undefined, { retry: false, refetchOnWindowFocus: true, staleTime: 60_000 });
  const join = trpc.rounds.join.useMutation({ onSuccess: () => { utils.rounds.myEntry.invalidate(); navigate("/today"); } });
  const [picked, setPicked] = useState<string | null>(null);
  const s = q.data?.season;
  // 2026-11-20 이전에 시작한 시험용 회차(예: 10.5기 미니 챌린지 시험)는 시즌 시작 화면을 띄우지 않는다
  if (!s || q.data?.track || String(s.startDate) < "2026-11-20") return <>{children}</>;
  return <SeasonScreen s={s as any} pending={join.isPending} picked={picked} onPick={t => { setPicked(t); join.mutate({ track: t }); }} />;
}

/** 시즌 시작 화면 미리보기 (2026-11-22): /preview/season?type=final 또는 ?type=detox — 저장 안 됨 */
export function SeasonPreview() {
  const detox = new URLSearchParams(window.location.search).get("type") === "detox";
  const [msg, setMsg] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const s: SeasonLite = detox
    ? { name: "슈퍼루틴 2027 시즌 1", startDate: "2027-01-12", planEnd: "2027-02-19", detoxStart: "2027-01-12", detoxEnd: "2027-01-14" }
    : { name: "2026 파이널 시즌", startDate: "2026-11-24", planEnd: "2026-12-23" };
  return (
    <div key={k}>
      <SeasonScreen s={s} onPick={t => setMsg(t === "detox" ? "3일 디톡스를 골랐어요" : `${s.name}을 골랐어요`)}
        note={<div className="text-center space-y-2">
          <div className="inline-block rounded-full border border-primary/50 px-3 py-1 text-[11px] text-primary">미리보기 · 눌러도 저장되지 않아요</div>
          {msg && <div className="text-sm font-semibold">✓ {msg} → 실제로는 '오늘' 화면으로 넘어가요</div>}
          <div><button type="button" className="text-xs underline text-muted-foreground" onClick={() => { setMsg(null); setK(n => n + 1); }}>처음부터 다시 보기</button></div>
        </div>} />
    </div>
  );
}
