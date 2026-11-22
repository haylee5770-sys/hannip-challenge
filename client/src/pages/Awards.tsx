// 시상식 (2026-11-20, 2026-11-22 개편) — 이게돼 챔피언 · 꾸준함 챔피언 · MVP(방장 선정). 슈퍼루틴 참여자만 대상
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { shareAwardCard, shareToast } from "@/lib/shareCards";
import { PAST_AWARDS } from "@/lib/pastAwards";
import { ChevronDown } from "lucide-react";

type W = { userId: number; name: string; count: number };
const md = (d?: string | null) => (d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : "");

/** 예전 페이지(역대 챌린지)에서도 쓰는 순위 상자 */
export function Podium({ title, sub, list, unit }: { title: string; sub: string; list: W[]; unit: string }) {
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="text-primary text-xs font-semibold">{sub}</div>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <Ranks list={list} unit={unit} />
    </section>
  );
}

function Ranks({ list, unit, emptyText = "아직 기록이 없어요." }: { list: W[]; unit: string; emptyText?: string }) {
  if (!list.length) return emptyText ? <p className="text-xs text-muted-foreground">{emptyText}</p> : null;
  return (
    <div className="space-y-2">
      {list.map((w, i) => (
        <div key={w.userId + "-" + i} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", i === 0 ? "bg-primary/15 border border-primary" : "bg-background/40")}>
          <span className="text-2xl w-8 text-center">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
          <span className="font-semibold flex-1">{w.name}</span>
          {unit && <span className="tabular-nums text-primary font-bold">{w.count}{unit}</span>}
        </div>
      ))}
    </div>
  );
}

function AwardCard({ sub, title, gift, desc, children }: { sub: string; title: string; gift: string; desc: string; children?: React.ReactNode }) {
  // 2026-11-22 (해이): 명예의 전당 색(포인트색 테두리·옅은 바탕). 왼쪽 = 설명 한 줄·상 이름·선물 / 오른쪽 절반 = 설명 글(연하게)
  return (
    <section className="flex-1 rounded-3xl border border-primary/40 bg-primary/10 px-4 py-3.5 flex flex-col justify-center gap-2">
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="min-w-0 space-y-1">
          <div className="text-primary text-[11px] font-semibold leading-snug break-keep">{sub}</div>
          <h2 className="text-xl font-black leading-tight">{title}</h2>
          <div className="inline-block rounded-full bg-primary/20 px-2.5 py-0.5 text-[12px] font-bold">🎁 {gift}</div>
        </div>
        <p className="text-[12px] text-muted-foreground/80 leading-relaxed break-keep">{desc}</p>
      </div>
      {children}
    </section>
  );
}

/** 역대 시상식 막대 (2026-11-22): 기수 · 받은 사람 이름. 누르면 상별로 펼쳐진다 */
function PastAwards() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="pt-8 space-y-2">
      <h2 className="text-center text-2xl font-black py-2">👑 역대 수상자 🏆</h2>
      {PAST_AWARDS.map(s => {
        const names = s.awards.map(a => a.name).join(", ");
        const on = open === s.no;
        return (
          <div key={s.no} className="rounded-2xl border border-white/10 bg-white/[0.06]" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}>
            <button type="button" onClick={() => setOpen(on ? null : s.no)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <span className="shrink-0"><b className="text-primary text-base">{s.no}</b>{s.sub && <span className="ml-1.5 text-[11px] text-muted-foreground">{s.sub}</span>}</span>
              <span className="flex-1 min-w-0 truncate text-sm">{names || <span className="text-muted-foreground">정리 중</span>}</span>
              {s.awards.length > 0 && <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", on && "rotate-180")} />}
            </button>
            {on && s.awards.length > 0 && (
              <div className="px-4 pb-3 space-y-1.5">
                {s.awards.map(a => (
                  <div key={a.label} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 text-xs text-primary font-semibold">{a.label}</span>
                    <span className="flex-1 font-semibold">{a.name}</span>
                    {a.note && <span className="text-xs text-muted-foreground">{a.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function MvpPicker({ seasonId }: { seasonId: number }) {
  const utils = trpc.useUtils();
  const members = trpc.members.list.useQuery();
  const [uid, setUid] = useState<number | "">("");
  const set = trpc.rounds.setMvp.useMutation({ onSuccess: () => { toast.success("MVP를 정했어요"); utils.rounds.ceremony.invalidate(); } });
  const list = (members.data ?? []) as Array<{ id: number; name: string | null }>;
  return (
    <div className="flex gap-2 pt-1">
      <select value={uid} onChange={e => setUid(e.target.value ? Number(e.target.value) : "")} className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <option value="">MVP 고르기 (방장만 보여요)</option>
        {list.map(m => <option key={m.id} value={m.id}>{m.name ?? "멤버"}</option>)}
      </select>
      <button type="button" disabled={!uid || set.isPending} className="rounded-xl glass-btn px-4 text-sm font-bold disabled:opacity-40"
        onClick={() => { const m = list.find(x => x.id === uid); if (m) set.mutate({ seasonId, userId: m.id, name: m.name ?? "멤버" }); }}>저장</button>
    </div>
  );
}

export default function Awards() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const q = trpc.rounds.ceremony.useQuery();
  if (q.isLoading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const d = q.data;
  // 테스트 기간(새 앱 이전에 끝난 옛 회차만 있을 때)에는 다음 시즌 안내
  const old = !d || d.status === "none" || (d.status === "final" && (d.season?.endDate ?? "") < "2026-11-20");
  const live = d?.status === "live";
  const seasonName = old ? "2026 파이널 시즌" : d!.season?.name;
  const range = old ? "11월 24일 ~ 12월 23일" : `${md(d!.season?.startDate)} ~ ${d!.season?.endDate ? md(d!.season.endDate) : "진행 중"}`;
  const byItge = old ? [] : ((d!.byItge ?? []) as W[]);
  const byTotal = old ? [] : ((d!.byTotal ?? []) as W[]);
  const mvp = old ? [] : (((d as any).mvp ?? []) as W[]);
  const wait = old ? "" : "아직 기록이 없어요.";

  return (
    <div>
      <div className="flex flex-col gap-2.5 min-h-[calc(100dvh-15rem)]">
      <section className="text-center pb-1">
        <div className="editorial-eyebrow text-primary mb-1">{live ? "LIVE · 진행 중" : old ? "COMING SOON" : "AWARDS · 최종 발표"}</div>
        <div className="text-lg md:text-xl font-semibold text-foreground/85 break-keep">{seasonName}</div>
        <h1 className="text-2xl md:text-4xl font-semibold">🏆 시상식</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{range}</p>
        {old && <p className="text-[11px] text-primary mt-0.5">시즌이 끝나면 발표돼요</p>}
      </section>

      <AwardCard sub="작은 변화를 가장 자주 발견한 크루" title="이게돼 챔피언" gift="스무디 15개"
        desc="슈퍼루틴 시즌 동안 “이게 돼!” 하고 나를 가장 많이 칭찬한 크루예요. 여러분이 스스로를 계속 칭찬했으면 좋겠어요. 이 상은 그래서 있어요.">
        <Ranks list={live ? byItge : byItge.slice(0, 1)} unit={live ? "개" : ""} emptyText={wait} />
        {live && byItge.length > 0 && <p className="text-[11px] text-muted-foreground">지금은 이게돼를 쓴 횟수예요. 최종 챔피언은 방장이 글을 보고 정해요.</p>}
      </AwardCard>

      <AwardCard sub="인증을 가장 많이 한 크루" title="꾸준함 챔피언" gift="스무디 3종"
        desc="하루도 빠짐없이 나와의 약속을 지킨 크루예요. 꾸준함이 자존감이 되고, 자존감이 인생을 바꿔요.">
        <Ranks list={live ? byTotal : byTotal.slice(0, 1)} unit="회" emptyText={wait} />
      </AwardCard>

      <AwardCard sub="방장이 선정한 한 명" title="MVP" gift="네이버페이 1만 원권"
        desc="숫자로는 다 보이지 않는 따뜻한 응원과 에너지로 우리 방을 밝혀 준 크루에게 드려요.">
        <Ranks list={mvp} unit="" emptyText={live ? "시즌이 끝나면 방장이 발표해요." : wait} />
        {isAdmin && !old && d?.season?.id ? <MvpPicker seasonId={d.season.id} /> : null}
      </AwardCard>

      {/* 🏆 수상 자랑하기 (2026-11-22): 최종 발표 후, 상 받은 본인에게만 */}
      {!old && !live && user && ([[byItge[0], "이게돼 챔피언", "작은 변화를 가장 자주 발견한 크루"], [byTotal[0], "꾸준함 챔피언", "인증을 가장 많이 한 크루"], [mvp[0], "MVP", "방장이 선정한 한 명"]] as const)
        .filter(([w]) => w && w.userId === user.id).map(([, title, sub]) => (
          <div key={title} className="flex justify-center">
            <button type="button" className="rounded-full glass-btn px-6 py-3 font-bold"
              onClick={async () => shareToast(await shareAwardCard({ name: user.name ?? "크루", avatar: (user as any).avatarUrl, seasonName: seasonName ?? "", title, sub }), toast)}>
              🏆 {title} 자랑하기
            </button>
          </div>
        ))}
      <p className="text-center text-[11px] text-muted-foreground leading-relaxed">슈퍼루틴 시즌 참여자만 받을 수 있어요 · 선물은 시즌마다 달라질 수 있어요. 방장 마음이에요 😊</p>
      </div>
      <PastAwards />
    </div>
  );
}
