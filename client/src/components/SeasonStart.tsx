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

export default function SeasonStart({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const q = trpc.rounds.myEntry.useQuery(undefined, { retry: false, refetchOnWindowFocus: true, staleTime: 60_000 });
  const join = trpc.rounds.join.useMutation({ onSuccess: () => { utils.rounds.myEntry.invalidate(); navigate("/today"); } });
  const [picked, setPicked] = useState<string | null>(null);
  const s = q.data?.season;
  if (!s || q.data?.track) return <>{children}</>;

  const hasDetox = !!(s.detoxStart && s.detoxEnd);
  const routineFrom = hasDetox ? addDay(s.detoxEnd!, 1) : s.startDate;
  const btn = "w-full rounded-3xl border border-white/20 bg-white/[0.06] backdrop-blur-xl px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_30px_rgba(0,0,0,0.35)] active:scale-[0.98] transition disabled:opacity-50";
  const go = (track: "detox" | "routine") => { setPicked(track); join.mutate({ track }); };

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
            <button type="button" className={btn} disabled={join.isPending} onClick={() => go("detox")}>
              <div className="text-xl font-black">3일 디톡스</div>
              <div className="text-xs text-muted-foreground mt-1">{md(s.detoxStart)} ~ {md(s.detoxEnd)} 디톡스 참여</div>
              {picked === "detox" && join.isPending && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
            </button>
          )}
          <button type="button" className={btn + " border-primary/60"} disabled={join.isPending} onClick={() => go("routine")}>
            <div className="text-xl font-black">{hasDetox ? s.name : `${s.name} 참여하기`} <span className="text-base">🏆</span></div>
            {hasDetox && <div className="text-xs text-muted-foreground mt-1">{md(s.detoxStart)} ~ {md(s.detoxEnd)} 디톡스 참여</div>}
            <div className="text-xs text-muted-foreground mt-0.5">{md(routineFrom)} ~ {md(s.planEnd)} 매일 루틴 참여</div>
            <div className="text-[11px] text-primary mt-1">시상식 대상이에요</div>
            {picked === "routine" && join.isPending && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
          </button>
        </div>
      </div>
    </div>
  );
}
