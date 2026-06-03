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
import { Redirect } from "wouter";
import { supabase } from "@/lib/supabase";

export default function Admin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user || user.role !== "admin") return <Redirect to="/today" />;

  return (
    <div>
      <section className="grid grid-cols-12 gap-6 items-end pb-10 border-b hairline">
        <div className="col-span-12">
          <div className="editorial-eyebrow text-muted-foreground mb-3">ADMIN</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl">
            관리 <span className="italic font-serif font-light">콘솔</span>
          </h1>
        </div>
      </section>

      <Tabs defaultValue="report" className="py-10">
        <TabsList className="bg-transparent border-b hairline rounded-none w-full justify-start gap-6 p-0 h-auto mb-8 flex-wrap">
          {[
            { v: "report", label: "01 · REPORT" },
            { v: "members", label: "02 · MEMBERS" },
            { v: "entrycode", label: "03 · 입장코드" },
            { v: "invites", label: "04 · INVITES" },
            { v: "schedules", label: "05 · REMINDERS" },
            { v: "seasons", label: "06 · SEASONS" },
          ].map(t => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-3 editorial-eyebrow"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="report"><DailyReport /></TabsContent>
        <TabsContent value="members"><MembersAdmin /></TabsContent>
        <TabsContent value="entrycode"><EntryCodeAdmin /></TabsContent>
        <TabsContent value="invites"><InvitesAdmin /></TabsContent>
        <TabsContent value="schedules"><SchedulesAdmin /></TabsContent>
        <TabsContent value="seasons"><SeasonsAdmin /></TabsContent>
      </Tabs>
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

  if (list.isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="border hairline divide-y">
      <div className="grid grid-cols-12 gap-4 p-4 bg-secondary editorial-eyebrow text-muted-foreground">
        <div className="col-span-4">멤버</div>
        <div className="col-span-3">상태</div>
        <div className="col-span-2">권한</div>
        <div className="col-span-3 text-right">액션</div>
      </div>
      {(list.data ?? []).map(u => (
        <div key={u.id} className="grid grid-cols-12 gap-4 p-4 items-center">
          <div className="col-span-4">
            <div className="font-serif text-lg">{u.name ?? "이름 없음"}</div>
            <div className="text-xs text-muted-foreground">{u.email}</div>
          </div>
          <div className="col-span-3">
            <span className={`editorial-eyebrow px-2 py-1 border hairline ${
              u.status === "approved" ? "bg-foreground text-background" :
              u.status === "pending" ? "bg-secondary" :
              "border-destructive/40 text-destructive"
            }`}>
              {u.status === "approved" ? "승인됨" : u.status === "pending" ? "대기" : "거절"}
            </span>
          </div>
          <div className="col-span-2 editorial-eyebrow">{u.role === "admin" ? "ADMIN" : "MEMBER"}</div>
          <div className="col-span-3 flex justify-end gap-2">
            {u.status === "pending" && (
              <>
                <Button size="sm" variant="outline" className="rounded-none"
                  onClick={() => setStatus.mutate({ userId: u.id, status: "approved" })}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> 승인
                </Button>
                <Button size="sm" variant="outline" className="rounded-none"
                  onClick={() => setStatus.mutate({ userId: u.id, status: "rejected" })}>
                  <XCircle className="h-3 w-3 mr-1" /> 거절
                </Button>
              </>
            )}
            {u.status === "approved" && (
              <Button size="sm" variant="outline" className="rounded-none"
                onClick={() => setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}>
                {u.role === "admin" ? "관리자 해제" : "관리자 지정"}
              </Button>
            )}
          </div>
        </div>
      ))}
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
        <h3 className="editorial-h2 text-2xl mb-1">시즌코드 설정</h3>
        <p className="text-sm text-muted-foreground mb-6">
          시즌별로 코드를 설정하세요. 멤버는 이 코드를 입력해야 해당 시즌에 활동할 수 있어요.
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
              <Button size="sm" variant="ghost" className="rounded-none" onClick={() => del.mutate({ id: inv.id })}>
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
        onDelete={() => remove.mutate({ slot: "morning" })}
        loading={upsert.isPending}
      />
      <ReminderRow
        slot="evening"
        title="저녁 리마인더"
        defaultCron="0 12 * * *"
        defaultHelp="매일 저녁 9시 (한국 시간)"
        existing={(list.data ?? []).find(j => j?.jobKey === "dailyReminder.evening") ?? null}
        onSave={(cron) => upsert.mutate({ slot: "evening", cron, enabled: true })}
        onDelete={() => remove.mutate({ slot: "evening" })}
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
                    onClick={() => {
                      if (confirm("정말 시즌을 즉시 종료할까요?")) close.mutate({ id: current.data!.id });
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
