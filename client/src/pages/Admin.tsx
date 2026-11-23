import { askConfirm } from "@/lib/askConfirm";
import PageTitle from "@/components/PageTitle";
import PurchasesAdmin from "@/components/PurchasesAdmin";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { todayLocal } from "@shared/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Trash2, CheckCircle2, XCircle, Search, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect, Link } from "wouter";
import { supabase } from "@/lib/supabase";

/** 챌린지 시작 / 종료 큰 버튼 (2026-11-20) */
/** 요즘 챙겨야 할 크루 (2026-11-21): 며칠째 힘이 없거나, 어제 너무 적게 먹었거나, 몸 상태 특이사항이 있는 크루 */
function CareList() {
  const q = trpc.wellness.careList.useQuery(undefined, { staleTime: 60_000 });
  if (q.isLoading) return null;
  const list = q.data ?? [];
  return (
    <section className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-500/5 p-4">
      <div className="font-semibold mb-2">💗 요즘 챙겨야 할 크루 <span className="text-sm text-muted-foreground">{list.length}명</span></div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">지금은 없어요.</p> : (
        <div className="space-y-1.5">
          {list.map(c => (
            <Link key={c.userId} href={`/member/${c.userId}`} className="block rounded-lg bg-background/50 px-3 py-2 text-sm hover:bg-background">
              <b>{c.name}</b> <span className="text-muted-foreground">· {c.reasons.join(" · ")}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RoundControl() {
  // 2026-11-22: 시즌 시작 — 이름·끝나는 날·(있으면) 3일 디톡스 날짜. 시작하면 모두의 번호가 1부터, 크루는 앱을 열 때 '새로운 시즌' 화면에서 참여를 고른다
  const utils = trpc.useUtils();
  const cur = trpc.rounds.seasonInfo.useQuery();
  const counts = trpc.rounds.entryCounts.useQuery({ seasonId: cur.data?.id ?? 0 }, { enabled: !!cur.data?.id });
  const after = () => { utils.rounds.invalidate(); };
  const [name, setName] = useState("2026 파이널 시즌");
  const [shortName, setShortName] = useState("26 파이널");
  const [planEnd, setPlanEnd] = useState("2026-12-23");
  const [detox, setDetox] = useState(false);
  const [dS, setDS] = useState(""); const [dE, setDE] = useState("");
  const start = trpc.rounds.startSeason.useMutation({ onSuccess: () => { toast.success("시즌 시작! 모두의 번호가 1번부터 시작되고, 크루들에게 '새로운 시즌' 화면이 떠요."); after(); }, onError: e => toast.error(e.message) });
  const end = trpc.rounds.end.useMutation({ onSuccess: (r) => { r.ok ? toast.success("시즌 종료! 시상식에 결과가 올라갔어요.") : toast.error((r as any).message ?? "진행 중인 시즌이 없어요"); after(); }, onError: e => toast.error(e.message) });
  const busy = start.isPending || end.isPending;
  const inp = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
  return (
    <section className="mt-6 rounded-2xl bg-card border border-primary/50 p-5 space-y-3">
      <div className="text-sm">
        {cur.data ? <>지금 진행 중: <b className="text-primary">{cur.data.name}</b> <span className="text-muted-foreground">({cur.data.startDate} ~ {cur.data.planEnd ?? ""})</span>
          {counts.data && <div className="text-xs text-muted-foreground mt-1">참여: 슈퍼루틴 {counts.data.routine}명 · 3일 디톡스 {counts.data.detox}명</div>}</>
          : <span className="text-muted-foreground">지금은 테스트 기간이에요. (기록은 남지만 시즌 번호·시상에는 들어가지 않아요)</span>}
      </div>
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="text-sm font-semibold">새 시즌 시작</div>
        <label className="block text-xs text-muted-foreground">시즌 이름<input className={inp} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="block text-xs text-muted-foreground">짧은 이름 (나의 변화 버튼)<input className={inp} value={shortName} onChange={e => setShortName(e.target.value)} placeholder="예: 27-1" /></label>
        <label className="block text-xs text-muted-foreground">끝나는 날<input type="date" className={inp} value={planEnd} onChange={e => setPlanEnd(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={detox} onChange={e => setDetox(e.target.checked)} /> 3일 디톡스 포함 (참여 버튼 2개)</label>
        {detox && <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">디톡스 시작<input type="date" className={inp} value={dS} onChange={e => setDS(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">디톡스 끝<input type="date" className={inp} value={dE} onChange={e => setDE(e.target.value)} /></label>
        </div>}
        <button type="button" disabled={busy || !name.trim() || !planEnd || (detox && (!dS || !dE))}
          onClick={async () => { if (await askConfirm(`'${name}'을 오늘 시작할까요?
모두의 인증 번호가 1번부터 다시 시작돼요.`, "시작")) start.mutate({ name: name.trim(), shortName: shortName.trim(), planEnd, detoxStart: detox ? dS : null, detoxEnd: detox ? dE : null }); }}
          className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-4 text-base disabled:opacity-50">▶ 시즌 시작</button>
        <p className="text-[11px] text-muted-foreground">예: 슈퍼루틴 2027 시즌 1 · 27-1 · 끝 2027-02-19 · 디톡스 2027-01-12 ~ 01-14</p>
      </div>
      <button type="button" disabled={busy || !cur.data} onClick={async () => { if (await askConfirm("시즌을 종료하고 시상식에 결과를 올릴까요?", "종료")) end.mutate(); }}
        className="w-full rounded-xl border-2 border-primary text-primary font-bold py-4 text-base disabled:opacity-40">■ 시즌 종료 · 결산하기</button>
      <p className="text-[11px] text-muted-foreground">종료하면 이게돼 챔피언·꾸준함 챔피언 후보가 자동 계산돼 '시상식'에 올라가요(슈퍼루틴 참여자만). MVP는 시상식 화면에서 직접 골라요.</p>
    </section>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  // 2026-11-23 (해이): 멤버(가로 긴 버튼) → 시즌(+이전 시즌 보기) → 명단(가장 큰 버튼) → 의견·신청 → 작은 버튼(리포트·입장코드·초대·알림). 누르면 바로 아래에 펼쳐짐
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user || user.role !== "admin") return <Redirect to="/today" />;
  const tog = (k: string) => setOpen(o => (o === k ? null : k));
  const Big = ({ k, label, sub, size = "md" }: { k: string; label: string; sub?: string; size?: "md" | "lg" }) => (
    <button type="button" onClick={() => tog(k)}
      className={`w-full flex items-center justify-between rounded-3xl border px-5 text-left transition-colors ${size === "lg" ? "h-20" : "h-16"} ${open === k ? "border-primary bg-primary/15" : "border-border bg-card"}`}>
      <span>
        <span className={`block font-black ${size === "lg" ? "text-2xl" : "text-xl"} ${open === k ? "text-primary" : ""}`}>{label}</span>
        {sub && <span className="block text-xs text-muted-foreground mt-0.5">{sub}</span>}
      </span>
      <span className={`text-lg text-muted-foreground transition-transform ${open === k ? "rotate-180" : ""}`}>⌄</span>
    </button>
  );
  const Small = ({ k, label }: { k: string; label: string }) => (
    <button type="button" onClick={() => tog(k)}
      className={`h-12 rounded-2xl border text-sm font-semibold ${open === k ? "border-primary bg-primary/15 text-primary" : "border-border bg-card"}`}>{label}</button>
  );

  return (
    <div className="space-y-3 pb-12">
      <section className="pb-2">
        <PageTitle eyebrow="ADMIN" title="관리" />
      </section>

      <NameRequests />

      <Big k="members" label="👥 멤버" sub="크루 목록 · 수락 · 요즘 챙겨야 할 크루" />
      {open === "members" && <div className="space-y-6 pb-4"><CareList /><MembersAdmin /></div>}

      <div className="pt-3">
        <RoundControl />
        <div className="mt-3">
          <button type="button" onClick={() => tog("seasons")}
            className={`w-full h-12 rounded-2xl border text-sm font-semibold ${open === "seasons" ? "border-primary bg-primary/15 text-primary" : "border-border bg-card"}`}>
            🗓 이전 시즌 보기 {open === "seasons" ? "▲" : "▼"}
          </button>
          {open === "seasons" && <div className="pt-4"><SeasonsAdmin /></div>}
        </div>
      </div>

      <div className="pt-3" />
      <Big k="roster" label="📋 명단" sub="이름·전화번호를 붙여 넣으면 가입할 때 바로 입장" size="lg" />
      {open === "roster" && <div className="pb-4"><RosterAdmin /></div>}

      <Big k="crew" label="💬 의견·신청" sub="크루 의견 · 상 받기 신청 · 이벤트" />
      {open === "crew" && <div className="pb-4"><CrewAdmin /></div>}

      <Big k="purchases" label="🛒 구매 기록" sub="예전 주문 넣기 · 네이버 자동 · 구매 순위 · 크루 공개" />
      {open === "purchases" && <div className="pb-4"><PurchasesAdmin /></div>}

      <div className="grid grid-cols-2 gap-2 pt-3">
        <Small k="report" label="📊 리포트" />
        <Small k="entrycode" label="🔑 입장코드" />
        <Small k="invites" label="✉️ 초대" />
        <Small k="schedules" label="⏰ 알림" />
      </div>
      {open === "report" && <DailyReport />}
      {open === "entrycode" && <EntryCodeAdmin />}
      {open === "invites" && <InvitesAdmin />}
      {open === "schedules" && <SchedulesAdmin />}
    </div>
  );
}

function DailyReport() {
  const [date, setDate] = useState(todayLocal());
  const report = trpc.admin.dailyReport.useQuery({ date });

  return (
    <div>
      <div className="flex items-end gap-3 mb-6">
        <div>
          <Label className="editorial-eyebrow text-muted-foreground mb-1 block">DATE</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-none border-foreground/30"
          />
        </div>
        <Button variant="outline" onClick={() => report.refetch()} className="rounded-none">새로고침</Button>
      </div>

      {report.isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="border hairline divide-y">
          <div className="grid grid-cols-12 gap-4 p-4 bg-secondary editorial-eyebrow text-muted-foreground">
            <div className="col-span-4">멤버</div>
            <div className="col-span-8">미수행 항목</div>
          </div>
          {(report.data ?? []).length === 0 ? (
            <div className="p-8 text-center font-serif italic text-muted-foreground">
              모두 기록을 완료했어요.
            </div>
          ) : (
            (report.data ?? []).map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-4 p-4 items-baseline">
                <div className="col-span-4 font-serif text-lg">{row.name}</div>
                <div className="col-span-8 font-serif italic text-muted-foreground">
                  {row.missing.length === 0
                    ? <span className="text-foreground not-italic">전체 기록 완료</span>
                    : `${row.name} : ${row.missing.join(", ")} 미수행`}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MembersAdmin() {
  const list = trpc.admin.listUsers.useQuery();
  const utils = trpc.useUtils();
  const setStatus = trpc.admin.setStatus.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("상태가 변경되었습니다"); },
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("권한이 변경되었습니다"); },
  });

  // 2026-11-22: 훅은 아래 return보다 먼저 (MEMBERS 오류 고침)
  const extras = trpc.admin.userExtras.useQuery();
  // 2026-11-23: 가입한 전화번호를 구매 기록(엑셀·네이버)과 자동 대조 → 수락할 때 엑셀을 따로 안 봐도 되게
  const buys = trpc.admin.purchaseSummary.useQuery(undefined, { staleTime: 60_000 });
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const fullReset = trpc.admin.fullReset.useMutation({ onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("완전히 처음 상태가 됐어요. 그 계정으로 들어가면 가입 첫 화면부터 나와요"); }, onError: e => toast.error(e.message) });
  const resetSignup = trpc.admin.resetSignup.useMutation({ onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("이제 그 계정으로 들어가면 가입 화면부터 다시 나와요"); } });
  if (list.isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  // 2026-11-21: 휴대폰에서 글씨가 겹치지 않게 한 사람씩 카드로. 수락을 기다리는 사람을 맨 위에
  const order = { pending: 0, approved: 1, rejected: 2 } as Record<string, number>;
  const rows = (list.data ?? []).slice().sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const pendingN = rows.filter(u => u.status === "pending").length;
  return (
    <div className="space-y-2">
      {pendingN > 0 && <p className="text-sm font-semibold text-primary">⏳ 수락을 기다리는 신청 {pendingN}명</p>}
      {rows.map(u => (
        <div key={u.id} className={`rounded-2xl border p-4 ${u.status === "pending" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">{u.name ?? "이름 없음"} {(u as any).realName ? <span className="text-xs text-muted-foreground font-normal">({(u as any).realName})</span> : null}</div>
              <div className="text-xs text-muted-foreground truncate allow-select">구글: {u.email}</div>
              {(u as any).phone && <div className="text-xs text-muted-foreground">{(u as any).phone}</div>}
              {extras.data?.[u.id]?.contactEmail && <div className="text-xs text-muted-foreground">✉️ {extras.data[u.id].contactEmail}</div>}
              {extras.data?.[u.id]?.address && <div className="text-xs text-muted-foreground leading-relaxed">🏠 {extras.data[u.id].address}</div>}
              {buys.data && (() => {
                const b = (buys.data as Record<number, { count: number; last: string | null }>)[u.id];
                if (b && b.count > 0) {
                  const recent = !!b.last && b.last >= yearAgo;
                  return <div className={`mt-1.5 inline-block rounded-lg px-2 py-1 text-xs font-semibold ${recent ? "bg-primary/15 text-primary" : "bg-secondary text-foreground"}`}>
                    ✅ 구매 이력 있음 · {b.count}번 · 마지막 {b.last ?? "–"}{recent ? " · 최근 1년 안" : " · 1년 넘음"}
                  </div>;
                }
                return u.status === "pending"
                  ? <div className="mt-1.5 inline-block rounded-lg bg-amber-500/15 border border-amber-400/40 px-2 py-1 text-xs font-semibold text-amber-200">⚠️ 구매 이력 없음 · 다른 번호로 샀는지 확인</div>
                  : null;
              })()}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                u.status === "approved" ? "border-primary/60 text-primary" : u.status === "pending" ? "glass-fill" : "border-destructive/50 text-destructive"}`}>
                {u.status === "approved" ? "수락됨" : u.status === "pending" ? "신청" : "거절"}
              </span>
              <span className="text-[10px] tracking-wider text-muted-foreground">{u.role === "admin" ? "방장" : "멤버"}</span>
            </div>
          </div>
          {/* 2026-11-23: 버튼이 4개면 한 줄에 안 들어가 '거절'이 카드 밖으로 나갔음 → 넘치면 다음 줄로 */}
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            {u.status === "pending" && (
              <>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={async () => { if (await askConfirm(`${u.name ?? "이 분"}의 신청을 거절할까요?`, "거절")) setStatus.mutate({ userId: u.id, status: "rejected" }); }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> 거절
                </Button>
                <Button size="sm" className="rounded-xl glass-btn" onClick={() => setStatus.mutate({ userId: u.id, status: "approved" })}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 수락
                </Button>
              </>
            )}
            {u.status === "rejected" && (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setStatus.mutate({ userId: u.id, status: "approved" })}>다시 수락</Button>
            )}
            {u.role !== "admin" && (
              <Button size="sm" variant="outline" className="rounded-xl"
                onClick={async () => { if (await askConfirm(`${u.name ?? "이 분"}이 가입을 처음부터 다시 하게 할까요?`, "다시 가입")) resetSignup.mutate({ userId: u.id }); }}>가입 처음부터</Button>
            )}
            {u.role !== "admin" && (
              <Button size="sm" variant="outline" className="rounded-xl border-destructive/50 text-destructive"
                onClick={async () => { if (await askConfirm(`${u.name ?? "이 분"}을 완전히 처음 상태로 만들까요?
프로필 사진·몸 정보·식단·물·운동 등 모든 기록이 지워지고 되돌릴 수 없어요. (시험용 계정에만 쓰세요)`, "완전 초기화")) fullReset.mutate({ userId: u.id }); }}>완전 초기화</Button>
            )}
            {u.status === "approved" && (
              <Button size="sm" variant="outline" className="rounded-xl"
                onClick={async () => { if (u.role !== "admin" || await askConfirm(`${u.name ?? "이 분"}의 방장 권한을 뺄까요?`, "빼기")) setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" }); }}>
                {u.role === "admin" ? "방장 권한 빼기" : "방장으로 지정"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 시크릿 입장 코드 (2026-11-21): 무작위 6자리, 정한 날짜마다 저절로 바뀜. 이 코드로 신청 → 방장이 MEMBERS에서 수락 */
function SecretCodeBox() {
  const utils = trpc.useUtils();
  const q = trpc.wellness.entryCode.useQuery();
  const rotate = trpc.wellness.rotateEntryCode.useMutation({
    onSuccess: () => { utils.wellness.entryCode.invalidate(); toast.success("새 코드로 바꿨어요"); },
    onError: (e) => toast.error(e.message),
  });
  if (q.isLoading || !q.data) return <Loader2 className="h-5 w-5 animate-spin" />;
  const d = q.data;
  return (
    <div className="rounded-2xl border border-primary p-4 mb-6 space-y-3">
      <div className="text-xs text-muted-foreground">지금 입장 코드 (크루에게 이 코드를 알려 주세요)</div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-3xl font-black tracking-[0.25em] text-primary">{d.code}</span>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard?.writeText(d.code); toast.success("코드를 복사했어요"); }}>
          <Copy className="h-3.5 w-3.5 mr-1" /> 복사
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">{d.createdAt}에 만들어짐 · <b className="text-foreground">{d.nextChange}</b>에 저절로 새 코드로 바뀌어요 ({d.days}일마다)</div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">바뀌는 간격</span>
        {[10, 14, 20, 30].map(n => (
          <button key={n} type="button" onClick={async () => { if (await askConfirm(`${n}일마다 바뀌게 하고, 지금 새 코드로 바꿀까요?`, "바꾸기")) rotate.mutate({ days: n }); }}
            className={`px-3 py-1 rounded-full border text-xs ${d.days === n ? "glass-fill" : "border-border"}`}>{n}일</button>
        ))}
        <Button size="sm" className="rounded-xl ml-auto" disabled={rotate.isPending}
          onClick={async () => { if (await askConfirm("지금 바로 새 코드로 바꿀까요? 예전 코드는 더 이상 안 돼요.", "바꾸기")) rotate.mutate({}); }}>
          지금 새 코드로
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">새 사람은 이 코드를 넣고 입장 신청을 해요 → <b className="text-foreground">02 · MEMBERS</b>에서 '수락'을 눌러야 들어올 수 있어요. 이미 들어온 멤버는 코드가 바뀌어도 그대로 이용해요.</p>
    </div>
  );
}

// ── 시즌코드 관리 + 멤버 검색 ──
function EntryCodeAdmin() {
  const setCode = trpc.admin.setSeasonCode.useMutation({
    onSuccess: () => toast.success("시즌코드가 저장됐어요"),
    onError: (e) => toast.error(e.message),
  });
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = trpc.admin.searchMembers.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.trim().length >= 1 }
  );

  // 시즌 목록은 admin.listSeasons 가 없을 수 있어 listUsers 대신 seasons 라우터 활용
  const seasonList = trpc.seasons.list.useQuery();

  return (
    <div className="space-y-10">
      {/* 시즌코드 설정 */}
      <div>
        <h3 className="editorial-h2 text-2xl mb-1">시크릿 입장 코드</h3>
        <SecretCodeBox />
        <p className="text-sm text-muted-foreground mb-6">
          아래 시즌별 코드는 따로 쓰고 싶을 때만 넣으세요. 넣지 않아도 공통 코드로 들어올 수 있어요.
        </p>
        {seasonList.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (seasonList.data as any[] ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground font-serif italic">시즌이 없어요. 먼저 시즌을 만들어 주세요.</p>
        ) : (
          <div className="space-y-3">
            {(seasonList.data as any[] ?? []).map((s: any) => (
              <div key={s.id} className="border hairline p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-lg">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.startDate} → {s.endDate} · {s.status === "active" ? "🟢 진행중" : s.status === "ended" ? "⚫ 종료" : "⏳ 예정"}</div>
                  {s.seasonCode && (
                    <div className="text-xs text-muted-foreground mt-1">현재 코드: <span className="font-mono tracking-widest text-foreground">{s.seasonCode}</span></div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="새 코드 입력"
                    value={codes[s.id] ?? ""}
                    onChange={e => setCodes(prev => ({ ...prev, [s.id]: e.target.value }))}
                    className="border border-foreground/30 bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground w-32 tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal"
                  />
                  <Button
                    size="sm"
                    className="rounded-none"
                    disabled={!codes[s.id]?.trim() || setCode.isPending}
                    onClick={() => setCode.mutate({ seasonId: s.id, code: codes[s.id] ?? "" })}
                  >
                    저장
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 멤버 검색 */}
      <div>
        <h3 className="editorial-h2 text-2xl mb-1">멤버 검색</h3>
        <p className="text-sm text-muted-foreground mb-4">성함, 닉네임, 이메일로 검색할 수 있어요.</p>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="성함 또는 이메일"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-foreground/30 bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
        </div>
        {searchQuery.trim().length >= 1 && (
          searchResults.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (searchResults.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground font-serif italic">검색 결과가 없어요.</p>
          ) : (
            <div className="border hairline divide-y">
              {(searchResults.data ?? []).map((u: any) => (
                <div key={u.id} className="p-4 space-y-1">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-serif text-lg">{u.realName || u.name || "이름 없음"}</span>
                    {u.realName && u.name && u.realName !== u.name && (
                      <span className="text-xs text-muted-foreground">닉네임: {u.name}</span>
                    )}
                    <span className={`editorial-eyebrow text-xs px-2 py-0.5 border hairline ${
                      u.status === "approved" ? "bg-foreground text-background" :
                      u.status === "pending" ? "bg-secondary" : "border-destructive/40 text-destructive"
                    }`}>
                      {u.status === "approved" ? "승인" : u.status === "pending" ? "대기" : "거절"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {u.email && <div>이메일: {u.email}</div>}
                    {u.phone && <div>전화: {u.phone}</div>}
                    {u.joinPurpose && <div>가입목적: {u.joinPurpose}</div>}
                    <div>가입일: {new Date(u.createdAt).toLocaleDateString("ko-KR")} · 마지막 접속: {new Date(u.lastSignedIn).toLocaleDateString("ko-KR")}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function InvitesAdmin() {
  const list = trpc.invitations.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.invitations.create.useMutation({
    onSuccess: () => { utils.invitations.list.invalidate(); toast.success("초대 링크가 생성되었습니다"); },
  });
  const del = trpc.invitations.delete.useMutation({
    onSuccess: () => { utils.invitations.list.invalidate(); toast.success("삭제되었습니다"); },
  });
  const [note, setNote] = useState("");

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

  return (
    <div>
      <div className="border hairline p-5 mb-6">
        <h3 className="editorial-h2 text-2xl mb-4">새 초대 링크</h3>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-9">
            <Label className="editorial-eyebrow text-muted-foreground mb-1 block">메모 (선택)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-none border-foreground/30" placeholder="예) 김희선용" />
          </div>
          <div className="col-span-12 md:col-span-3 flex items-end">
            <Button
              className="rounded-none w-full"
              disabled={create.isPending}
              onClick={() => create.mutate({ note: note.trim() || undefined })}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "생성"}
            </Button>
          </div>
        </div>
      </div>

      <div className="border hairline divide-y">
        <div className="grid grid-cols-12 gap-4 p-4 bg-secondary editorial-eyebrow text-muted-foreground">
          <div className="col-span-7">초대 링크</div>
          <div className="col-span-3">상태</div>
          <div className="col-span-2 text-right">액션</div>
        </div>
        {(list.data ?? []).map(inv => (
          <div key={inv.id} className="grid grid-cols-12 gap-4 p-4 items-center">
            <div className="col-span-7">
              <div className="font-mono text-xs break-all">{inviteUrl(inv.token)}</div>
              {inv.note && <div className="text-xs text-muted-foreground italic font-serif mt-1">{inv.note}</div>}
            </div>
            <div className="col-span-3">
              {inv.usedAt ? (
                <span className="editorial-eyebrow text-muted-foreground">사용됨</span>
              ) : inv.expiresAt && new Date(inv.expiresAt) < new Date() ? (
                <span className="editorial-eyebrow text-destructive">만료</span>
              ) : (
                <span className="editorial-eyebrow">활성</span>
              )}
              {inv.expiresAt && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  ~ {new Date(inv.expiresAt).toLocaleDateString("ko-KR")}
                </div>
              )}
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="rounded-none" onClick={() => {
                navigator.clipboard.writeText(inviteUrl(inv.token));
                toast.success("링크가 복사되었습니다");
              }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="rounded-none" onClick={async () => { if (await askConfirm("이 초대 링크를 삭제할까요?")) del.mutate({ id: inv.id }); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="p-8 text-center font-serif italic text-muted-foreground">
            아직 생성된 초대 링크가 없어요.
          </div>
        )}
      </div>
    </div>
  );
}

function SchedulesAdmin() {
  const list = trpc.admin.listSchedules.useQuery();
  const utils = trpc.useUtils();
  const upsert = trpc.admin.upsertReminder.useMutation({
    onSuccess: () => { utils.admin.listSchedules.invalidate(); toast.success("리마인더가 저장되었습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.admin.deleteReminder.useMutation({
    onSuccess: () => { utils.admin.listSchedules.invalidate(); toast.success("리마인더가 삭제되었습니다"); },
  });

  return (
    <div className="space-y-6">
      <p className="font-serif italic text-muted-foreground text-sm border-l-2 border-accent pl-3">
        설정한 시간(UTC 기준 cron)에 멤버들이 오늘의 체중·식단·운동을 기록했는지 확인하고,
        미수행 멤버 목록을 관리자에게 자동으로 알림으로 보내드려요.
      </p>
      <ReminderRow
        slot="morning"
        title="아침 리마인더"
        defaultCron="0 23 * * *"
        defaultHelp="매일 오전 8시 (한국 시간)"
        existing={(list.data ?? []).find(j => j?.jobKey === "dailyReminder.morning") ?? null}
        onSave={(cron) => upsert.mutate({ slot: "morning", cron, enabled: true })}
        onDelete={async () => { if (await askConfirm("아침 알림을 삭제할까요?")) remove.mutate({ slot: "morning" }); }}
        loading={upsert.isPending}
      />
      <ReminderRow
        slot="evening"
        title="저녁 리마인더"
        defaultCron="0 12 * * *"
        defaultHelp="매일 저녁 9시 (한국 시간)"
        existing={(list.data ?? []).find(j => j?.jobKey === "dailyReminder.evening") ?? null}
        onSave={(cron) => upsert.mutate({ slot: "evening", cron, enabled: true })}
        onDelete={async () => { if (await askConfirm("저녁 알림을 삭제할까요?")) remove.mutate({ slot: "evening" }); }}
        loading={upsert.isPending}
      />
    </div>
  );
}

function ReminderRow({
  slot, title, defaultCron, defaultHelp, existing, onSave, onDelete, loading,
}: {
  slot: "morning" | "evening";
  title: string;
  defaultCron: string;
  defaultHelp: string;
  existing: { jobKey: string; cronExpression: string | null; enabled: boolean | null } | null;
  onSave: (cron: string) => void;
  onDelete: () => void;
  loading: boolean;
}) {
  const [cron, setCron] = useState(existing?.cronExpression ?? defaultCron);
  return (
    <div className="border hairline p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="editorial-eyebrow text-muted-foreground">{slot.toUpperCase()}</div>
          <h3 className="editorial-h2 text-2xl">{title}</h3>
        </div>
        {existing && (
          <span className="editorial-eyebrow px-2 py-1 border hairline bg-foreground text-background">
            ACTIVE
          </span>
        )}
      </div>
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-12 md:col-span-7">
          <Label className="editorial-eyebrow text-muted-foreground mb-1 block">CRON (UTC)</Label>
          <Input value={cron} onChange={(e) => setCron(e.target.value)} className="rounded-none border-foreground/30 font-mono" />
          <div className="text-xs text-muted-foreground mt-1 font-serif italic">기본값: {defaultHelp}</div>
        </div>
        <div className="col-span-6 md:col-span-3">
          <Button onClick={() => onSave(cron.trim())} disabled={loading} className="rounded-none w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? "업데이트" : "활성화"}
          </Button>
        </div>
        {existing && (
          <div className="col-span-6 md:col-span-2">
            <Button variant="outline" onClick={onDelete} className="rounded-none w-full">중지</Button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ============== SEASONS ============== */
function SeasonsAdmin() {
  const list = trpc.seasons.list.useQuery();
  const current = trpc.seasons.current.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.seasons.create.useMutation({
    onSuccess: () => {
      utils.seasons.list.invalidate();
      utils.seasons.current.invalidate();
      utils.seasons.myProgress.invalidate();
      utils.seasons.leaderboard.invalidate();
      toast.success("새 시즌이 시작되었어요");
    },
    onError: (e) => toast.error("시즌 생성 실패: " + e.message),
  });
  const close = trpc.seasons.close.useMutation({
    onSuccess: () => {
      utils.seasons.list.invalidate();
      utils.seasons.current.invalidate();
      toast.success("시즌이 종료되었어요");
    },
    onError: (e) => toast.error("종료 실패: " + e.message),
  });
  const update = trpc.seasons.update.useMutation({
    onSuccess: () => {
      utils.seasons.list.invalidate();
      utils.seasons.current.invalidate();
      utils.seasons.myProgress.invalidate();
      setEditingId(null);
      toast.success("시즌 정보가 수정되었어요");
    },
    onError: (e) => toast.error(e.message),
  });

  const [createDirectLoading, setCreateDirectLoading] = useState(false);
  const [dbHealthMsg, setDbHealthMsg] = useState<string | null>(null);

  const checkDbHealth = async () => {
    setDbHealthMsg("확인 중...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/db-health", {
        headers: session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json();
      if (data.ok) {
        setDbHealthMsg(`✅ DB 연결 정상 · 시즌 ${data.seasonCount}개 · 진행 중 시즌 ID: ${data.activeSeasonId ?? "없음"}`);
      } else {
        setDbHealthMsg(`❌ DB 오류: ${data.error}`);
      }
    } catch (e: any) {
      setDbHealthMsg(`❌ 네트워크 오류: ${e.message}`);
    }
  };

  const handleDirectCreate = async () => {
    setCreateDirectLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/create-season", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name, startDate, totalDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("실패: " + (data.error ?? res.statusText));
      } else {
        toast.success(`시즌 생성 완료! (${data.seasonNumber}기, id=${data.id})`);
        utils.seasons.list.invalidate();
        utils.seasons.current.invalidate();
        utils.seasons.myProgress.invalidate();
      }
    } catch (e: any) {
      toast.error("네트워크 오류: " + e.message);
    } finally {
      setCreateDirectLoading(false);
    }
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState<number>(1);
  const [editTotalDays, setEditTotalDays] = useState<number>(13);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const startEdit = (s: { id: number; name: string; seasonNumber: number | null; totalDays: number | null; startDate: string; endDate: string }) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditNumber(s.seasonNumber ?? 1);
    setEditTotalDays(s.totalDays ?? 13);
    setEditStartDate(s.startDate);
    setEditEndDate(s.endDate);
  };

  const nextNumber = (list.data?.reduce((m, s: { seasonNumber?: number | null }) => Math.max(m, s.seasonNumber ?? 0), 0) ?? 0) + 1;
  const [name, setName] = useState(`${nextNumber}기 챌린지`);
  const [startDate, setStartDate] = useState(todayLocal());
  const [totalDays, setTotalDays] = useState<number>(13);

  const calcEnd = (s: string, days: number) => {
    const d = new Date(s + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + (days - 1));
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-10">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="border hairline p-6 space-y-4">
          <div className="editorial-eyebrow text-muted-foreground">CURRENT</div>
          <h3 className="font-serif text-2xl">진행 중인 시즌</h3>
          {current.data ? (
            editingId === current.data.id ? (
              <SeasonEditForm
                name={editName} setName={setEditName}
                seasonNumber={editNumber} setSeasonNumber={setEditNumber}
                totalDays={editTotalDays} setTotalDays={setEditTotalDays}
                startDate={editStartDate} setStartDate={setEditStartDate}
                endDate={editEndDate} setEndDate={setEditEndDate}
                isPending={update.isPending}
                onSave={() => update.mutate({ id: editingId!, name: editName, seasonNumber: editNumber, totalDays: editTotalDays, startDate: editStartDate, endDate: editEndDate })}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="space-y-2">
                <div className="font-serif text-xl">
                  {current.data.seasonNumber ? `${current.data.seasonNumber}기 · ` : ""}{current.data.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {current.data.startDate} → {current.data.endDate} · {current.data.totalDays ?? 13}일
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => startEdit(current.data! as any)}>
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (await askConfirm("정말 시즌을 즉시 종료할까요?", "종료")) close.mutate({ id: current.data!.id });
                    }}
                  >
                    즉시 종료
                  </Button>
                </div>
              </div>
            )
          ) : (
            <p className="text-muted-foreground text-sm">진행 중인 시즌이 없습니다.</p>
          )}
        </div>

        <div className="border hairline p-6 space-y-4">
          <div className="editorial-eyebrow text-muted-foreground">CREATE</div>
          <h3 className="font-serif text-2xl">새 시즌 시작</h3>
          <p className="text-xs text-muted-foreground">
            기존 진행 중 시즌이 있다면 자동으로 종료됩니다. 기수는 자동으로 {nextNumber}기로 부여됩니다.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="editorial-eyebrow text-muted-foreground">시즌 이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-none mt-1" />
            </div>
            <div>
              <Label className="editorial-eyebrow text-muted-foreground">챌린지 길이</Label>
              <div className="flex gap-2 mt-1">
                {[13, 30].map(d => (
                  <Button
                    key={d}
                    type="button"
                    variant={totalDays === d ? "default" : "outline"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setTotalDays(d)}
                  >{d}일</Button>
                ))}
                <Input
                  type="number"
                  min={2}
                  max={365}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Math.max(2, Math.min(365, parseInt(e.target.value || "13", 10))))}
                  className="rounded-none w-20"
                />
              </div>
            </div>
            <div>
              <Label className="editorial-eyebrow text-muted-foreground">시작일</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-none mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                예상 종료일: <span className="font-serif">{calcEnd(startDate, totalDays)}</span> · 총 {totalDays}일
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => create.mutate({ name, startDate, totalDays })}
                disabled={create.isPending || !name.trim()}
                className="rounded-none"
              >
                {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                시즌 시작
              </Button>
              <Button
                variant="outline"
                onClick={handleDirectCreate}
                disabled={createDirectLoading || !name.trim()}
                className="rounded-none text-xs"
              >
                {createDirectLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                직접 생성 (백업)
              </Button>
              <Button
                variant="ghost"
                onClick={checkDbHealth}
                className="rounded-none text-xs text-muted-foreground"
              >
                DB 상태 확인
              </Button>
            </div>
            {dbHealthMsg && (
              <p className="text-xs font-mono mt-2 text-muted-foreground">{dbHealthMsg}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="editorial-eyebrow text-muted-foreground mb-3">HISTORY</div>
        <div className="border hairline divide-y hairline">
          {list.data?.length ? (
            list.data.map((s) => (
              <div key={s.id} className="px-4 py-3 text-sm">
                {editingId === s.id ? (
                  <div className="py-2">
                    <SeasonEditForm
                      name={editName} setName={setEditName}
                      seasonNumber={editNumber} setSeasonNumber={setEditNumber}
                      totalDays={editTotalDays} setTotalDays={setEditTotalDays}
                      startDate={editStartDate} setStartDate={setEditStartDate}
                      endDate={editEndDate} setEndDate={setEditEndDate}
                      isPending={update.isPending}
                      onSave={() => update.mutate({ id: editingId!, name: editName, seasonNumber: editNumber, totalDays: editTotalDays, startDate: editStartDate, endDate: editEndDate })}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-serif text-base">
                        {s.seasonNumber ? `${s.seasonNumber}기 · ` : ""}{s.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.startDate} → {s.endDate} {s.totalDays ? `· ${s.totalDays}일` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="editorial-eyebrow text-muted-foreground">
                        {s.status === "active" ? "진행 중" : "종료"}
                      </span>
                      <Button size="sm" variant="ghost" className="rounded-none text-xs" onClick={() => startEdit(s as any)}>
                        수정
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-muted-foreground">아직 시즌이 없어요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeasonEditForm({
  name, setName,
  seasonNumber, setSeasonNumber,
  totalDays, setTotalDays,
  startDate, setStartDate,
  endDate, setEndDate,
  isPending, onSave, onCancel,
}: {
  name: string; setName: (v: string) => void;
  seasonNumber: number; setSeasonNumber: (v: number) => void;
  totalDays: number; setTotalDays: (v: number) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">시즌 이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-none" />
        </div>
        <div>
          <Label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">기수 (예: 10)</Label>
          <Input
            type="number" min={1}
            value={seasonNumber}
            onChange={(e) => setSeasonNumber(Math.max(1, parseInt(e.target.value || "1", 10)))}
            className="rounded-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">시작일</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-none" />
        </div>
        <div>
          <Label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">종료일</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-none" />
        </div>
        <div>
          <Label className="editorial-eyebrow text-muted-foreground text-xs mb-1 block">총 일수</Label>
          <Input
            type="number" min={2} max={365}
            value={totalDays}
            onChange={(e) => setTotalDays(Math.max(2, Math.min(365, parseInt(e.target.value || "13", 10))))}
            className="rounded-none"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={isPending || !name.trim()} className="rounded-none">
          {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}저장
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="rounded-none">취소</Button>
      </div>
    </div>
  );
}


/** 크루 명단 (2026-11-22): 이름+전화번호가 여기 있는 사람은 가입하면 수락 없이 바로 입장 */
function RosterAdmin() {
  const utils = trpc.useUtils();
  const list = trpc.admin.rosterList.useQuery();
  const [text, setText] = useState("");
  const imp = trpc.admin.rosterImport.useMutation({
    onSuccess: (r) => { utils.admin.rosterList.invalidate(); setText(""); toast.success(`새로 ${r.added}명 · 바뀜 ${r.updated}명${r.skipped.length ? ` · 못 읽은 줄 ${r.skipped.length}개` : ""}`); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.admin.rosterDelete.useMutation({ onSuccess: () => utils.admin.rosterList.invalidate() });
  const rows = list.data ?? [];
  const joined = rows.filter((r: any) => r.usedByUserId).length;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary p-4 space-y-3">
        <div className="text-sm font-semibold">명단 붙여 넣기</div>
        <p className="text-xs text-muted-foreground leading-relaxed">한 줄에 한 사람 · <b className="text-foreground">닉네임, 이름, 전화번호, 주소</b> 순서 (쉼표나 엑셀 칸 그대로). 같은 번호가 있으면 새 내용으로 바뀌어요.<br />여기 있는 사람은 가입할 때 이름·전화번호가 맞으면 <b className="text-foreground">수락 없이 바로 입장</b>해요.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={10} placeholder={"로제, 이소민, 010-0000-0000, 경기도 …"} className="w-full min-h-[14rem] rounded-xl border border-border bg-background p-3 text-base leading-relaxed" />
        <Button className="rounded-xl glass-btn" disabled={!text.trim() || imp.isPending} onClick={() => imp.mutate({ text })}>저장</Button>
      </div>
      <p className="text-sm font-semibold">명단 {rows.length}명 · 가입 완료 {joined}명</p>
      <div className="space-y-2">
        {rows.map((r: any) => (
          <div key={r.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${r.usedByUserId ? "border-primary/50" : "border-border"}`}>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{r.nickname} <span className="text-xs text-muted-foreground font-normal">{r.realName} · {r.phone}</span></div>
              {r.address && <div className="text-xs text-muted-foreground leading-relaxed">{r.address}</div>}
              <div className={`text-[11px] mt-1 ${r.usedByUserId ? "text-primary font-semibold" : "text-muted-foreground"}`}>{r.usedByUserId ? `✓ 가입함 (${r.userName ?? ""})` : "아직 가입 전"}</div>
              {r.userEmail && <div className="text-[11px] text-muted-foreground allow-select">구글: {r.userEmail}</div>}
            </div>
            <button type="button" className="text-xs text-muted-foreground underline shrink-0"
              onClick={async () => { if (await askConfirm(`${r.nickname} 님을 명단에서 뺄까요?`, "빼기")) del.mutate({ id: r.id }); }}>빼기</button>
          </div>
        ))}
      </div>
    </div>
  );
}


/** 닉네임 변경 요청 (2026-11-22): 크루가 바꾼 닉네임은 방장이 승인해야 바뀐다 */
function NameRequests() {
  const utils = trpc.useUtils();
  const q = trpc.admin.nameRequests.useQuery();
  const decide = trpc.admin.decideName.useMutation({ onSuccess: () => utils.admin.nameRequests.invalidate() });
  const rows = (q.data ?? []) as any[];
  if (!rows.length) return null;
  return (
    <div className="rounded-2xl border border-primary p-4 space-y-2">
      <div className="text-sm font-bold">✏️ 닉네임 변경 요청 {rows.length}건</div>
      {rows.map(r => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{r.name} → <b className="text-primary">{r.pendingName}</b></span>
          <button type="button" className="rounded-full glass-btn px-3 py-1 text-xs" onClick={() => decide.mutate({ userId: r.id, ok: true })}>승인</button>
          <button type="button" className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground" onClick={() => decide.mutate({ userId: r.id, ok: false })}>거절</button>
        </div>
      ))}
    </div>
  );
}


/** 의견·신청 (2026-11-22): 크루가 보낸 의견, 선물·이벤트 신청 목록, 열린 이벤트 관리 */
function CrewAdmin() {
  const utils = trpc.useUtils();
  const fb = trpc.crew.feedbacks.useQuery();
  const rq = trpc.crew.requests.useQuery();
  const ev = trpc.crew.events.useQuery();
  const [title, setTitle] = useState("");
  const done = trpc.crew.feedbackDone.useMutation({ onSuccess: () => utils.crew.feedbacks.invalidate() });
  const sent = trpc.crew.requestSent.useMutation({ onSuccess: () => utils.crew.requests.invalidate() });
  const add = trpc.crew.addEvent.useMutation({ onSuccess: () => { setTitle(""); utils.crew.events.invalidate(); } });
  const openEv = trpc.crew.setEventOpen.useMutation({ onSuccess: () => utils.crew.events.invalidate() });
  const day = (d: any) => { const t = new Date(new Date(d).getTime() + 9 * 3600_000); return `${t.getUTCMonth() + 1}/${t.getUTCDate()}`; };
  // 2026-11-23: 의견은 몇 시 몇 분까지 (앱을 고친 시각과 비교해 '고치기 전 의견'인지 알 수 있게)
  const dt = (d: any) => { const t = new Date(new Date(d).getTime() + 9 * 3600_000); return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`; };
  const copyAll = () => {
    const rows = (rq.data ?? []).filter((r: any) => !r.sent).map((r: any) => [r.label, r.nickname ?? "", r.realName, r.phone, r.address].join(String.fromCharCode(9)));
    navigator.clipboard?.writeText([["신청", "닉네임", "이름", "전화번호", "주소"].join(String.fromCharCode(9)), ...rows].join(String.fromCharCode(10))); toast.success("아직 안 보낸 신청을 엑셀 형식으로 복사했어요");
  };
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-bold">🎁 선물·이벤트 신청 {(rq.data ?? []).filter((r: any) => !r.sent).length}건</h3>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={copyAll}><Copy className="h-3.5 w-3.5 mr-1" />엑셀로 복사</Button></div>
        {(rq.data ?? []).map((r: any) => (
          <div key={r.id} className={`rounded-2xl border p-3 text-sm ${r.sent ? "border-border opacity-60" : "border-primary/50"}`}>
            <div className="font-semibold">{r.label}</div>
            <div>{r.nickname} ({r.realName}) · {r.phone}</div>
            <div className="text-xs text-muted-foreground allow-select">{r.address}</div>
            <div className="flex justify-between items-center mt-1"><span className="text-[11px] text-muted-foreground">{day(r.createdAt)} 신청</span>
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!r.sent} onChange={e => sent.mutate({ id: r.id, sent: e.target.checked })} />보냄</label></div>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h3 className="font-bold">🎉 열린 이벤트 (크루가 '이벤트 신청'에서 고를 수 있어요)</h3>
        <div className="flex gap-2"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 11월 후기 이벤트 당첨자 선물" className="rounded-xl" />
          <Button className="rounded-xl" disabled={!title.trim()} onClick={() => add.mutate({ title })}>열기</Button></div>
        {(ev.data ?? []).map((e: any) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <span className={e.open ? "" : "text-muted-foreground line-through"}>{e.title}</span>
            <button type="button" className="text-xs underline" onClick={() => openEv.mutate({ id: e.id, open: !e.open })}>{e.open ? "닫기" : "다시 열기"}</button>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h3 className="font-bold">💬 크루 의견 {(fb.data ?? []).filter((f: any) => !f.done).length}건</h3>
        {(fb.data ?? []).map((f: any) => (
          <div key={f.id} className={`rounded-2xl border p-3 text-sm space-y-1 ${f.done ? "opacity-60 border-border" : "border-primary/50"}`}>
            <div className="flex justify-between"><b>{f.kind === "bug" ? "🐞 오류" : "💡 의견"} · {f.name ?? "멤버"}</b><span className="text-[11px] text-muted-foreground text-right">{dt(f.createdAt)}{f.editedAt ? <><br />고침 {dt(f.editedAt)}</> : null}</span></div>
            <div className="whitespace-pre-wrap allow-select">{f.text}</div>
            {f.imageUrl && <a href={f.imageUrl} target="_blank" rel="noreferrer"><img src={f.imageUrl} alt="첨부" className="mt-1 max-h-60 rounded-xl" /></a>}
            <FeedbackReplyBox f={f} />
            <label className="text-xs flex items-center gap-1 justify-end"><input type="checkbox" checked={!!f.done} onChange={e => done.mutate({ id: f.id, done: e.target.checked })} />확인함</label>
          </div>
        ))}
      </section>
    </div>
  );
}

/** 의견 답장 (2026-11-23): 쓰면 크루의 '내가 보낸 의견' 아래에 '방장 답장'으로 보여요 */
function FeedbackReplyBox({ f }: { f: any }) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(!f.reply);
  const [text, setText] = useState<string>(f.reply ?? "");
  const save = trpc.crew.feedbackReply.useMutation({
    onSuccess: () => { utils.crew.feedbacks.invalidate(); setEditing(false); toast.success(text.trim() ? "답장을 보냈어요. 크루의 의견 화면에 보여요." : "답장을 지웠어요."); },
    onError: e => toast.error(e.message),
  });
  if (!editing && f.reply) return (
    <div className="mt-2 rounded-xl bg-primary/10 border border-primary/30 p-2.5">
      <div className="text-[11px] font-bold text-primary mb-1">💚 보낸 답장 {f.repliedAt ? `· ${new Date(f.repliedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}</div>
      <div className="whitespace-pre-wrap text-sm">{f.reply}</div>
      <button type="button" className="mt-1 text-xs underline text-muted-foreground" onClick={() => setEditing(true)}>답장 고치기</button>
    </div>
  );
  // 2026-11-23 해이: 누르면 답장 칸에 그 글이 써져요 → 고쳐도 되고 그대로 '답장 보내기'
  const QUICK = [
    ["✅ 해결했어요", "해결했습니다! 의견 감사합니다 💚 덕분에 앱이 더 좋아졌어요."],
    ["🔧 고치는 중", "확인했어요! 지금 고치고 있어요. 조금만 기다려 주세요 💚"],
    ["💡 좋은 의견", "좋은 의견 감사해요! 검토해서 반영해 볼게요 💚"],
    ["🙏 테스트 부탁", "고쳐 두었어요! 한번 테스트해 보시고, 문제가 있으면 다시 의견 남겨 주세요 💚"],
  ] as const;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map(([l, msg]) => (
          <button key={l} type="button" disabled={save.isPending}
            // 2026-11-23 해이: 누를 때마다 이어서 써지게. 같은 걸 한 번 더 누르면 그 문장은 빠짐
            onClick={() => setText(t => t.includes(msg)
              ? t.replace(msg, "").replace(/\n{2,}/g, "\n").trim()
              : (t.trim() ? `${t.trim()}\n${msg}` : msg))}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${text.includes(msg) ? "border-primary bg-primary text-primary-foreground" : "border-primary/50 text-primary"}`}>{l}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="직접 답장 쓰기 (크루에게 보여요)"
        className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary" />
      <div className="flex justify-end gap-2">
        {f.reply && <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { setText(f.reply); setEditing(false); }}>취소</Button>}
        <Button size="sm" className="rounded-xl glass-btn" disabled={save.isPending || (!text.trim() && !f.reply)} onClick={() => save.mutate({ id: f.id, reply: text })}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : f.reply ? "고친 답장 보내기" : "답장 보내기"}
        </Button>
      </div>
    </div>
  );
}
