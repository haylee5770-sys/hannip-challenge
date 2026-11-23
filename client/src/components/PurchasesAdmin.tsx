// 관리자 🛒 구매 기록 (2026-11-23)
// - 예전 주문: 정리한 파일(1122_구매기록_앱업로드용.txt 같은 탭 구분 글)을 올린다. 같은 파일을 또 올려도 겹치지 않는다
// - 앞으로 주문: 네이버 열쇠를 넣으면 하루 1번 자동. '지금 가져오기'로 바로 가져올 수도 있다
// - 구매 기록은 방장만 본다 (2026-11-23 해이 결정: 크루에게 횟수·금액을 보여 주면 '돈 아깝다'로 이어질 수 있어서)
// - 누가 누군지는 전화번호(주문자 또는 받는 분)로만 맞춘다. 이름은 안 본다
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { askConfirm } from "@/lib/askConfirm";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const box = "rounded-2xl border border-border bg-card p-4 space-y-3";
const btn = "h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-40";
const fmtWon = (n: number) => (n > 0 ? `${n.toLocaleString()}원` : "");

function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); }

export default function PurchasesAdmin() {
  const utils = trpc.useUtils();
  const stats = trpc.admin.purchaseStats.useQuery();
  const [period, setPeriod] = useState<"all" | "3m" | "year">("all");
  const since = period === "all" ? null : period === "3m" ? addMonths(new Date(), -3) : `${new Date().getFullYear()}-01-01`;
  // 2026-11-23: [전체] 모든 구매자 / [우리 방] 앱에 가입한 크루만(안 산 크루도 0번으로)
  const [tab, setTab] = useState<"all" | "crew">("all");
  const rankAll = trpc.admin.purchaseRanking.useQuery({ since }, { enabled: tab === "all" });
  const rankCrew = trpc.admin.purchaseCrewRanking.useQuery({ since }, { enabled: tab === "crew" });
  const ranking = tab === "all" ? rankAll : rankCrew;
  const [openUser, setOpenUser] = useState<number | null>(null);
  const detail = trpc.admin.purchasesFor.useQuery({ userId: openUser ?? 0 }, { enabled: openUser != null });

  const refresh = () => { utils.admin.purchaseStats.invalidate(); utils.admin.purchaseRanking.invalidate(); utils.admin.purchaseCrewRanking.invalidate(); utils.admin.purchasesFor.invalidate(); };
  const imp = trpc.admin.purchaseImport.useMutation({
    onSuccess: r => { toast.success(`새로 ${r.added}건 넣었어요 · 이미 있던 ${r.same}건 · 건너뜀 ${r.skipped}건`, { duration: 8000 }); refresh(); },
    onError: e => toast.error(e.message),
  });
  const sync = trpc.admin.naverSync.useMutation({
    onSuccess: r => { r.ok ? toast.success(r.message) : toast.error(r.message); refresh(); },
    onError: e => toast.error(e.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim()).length;
    if (await askConfirm(`'${f.name}' 파일을 넣을까요?\n(${lines}줄 · 이미 있는 주문은 다시 안 들어가요)`, "넣기")) imp.mutate({ text });
    if (fileRef.current) fileRef.current.value = "";
  };

  const s = stats.data;
  const nv = s?.naverStatus;
  const rows = (ranking.data ?? []) as Array<{ userId: number | null; nickname: string | null; buyerName: string | null; phoneTail: string; count: number; boxes: number; amount: number; last: string | null; hasPhone?: boolean }>;
  const joined = rows.filter(r => r.userId).length;
  const bought = rows.filter(r => r.count > 0).length;

  return (
    <div className="space-y-4">
      {/* 한눈에 */}
      <div className={box}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-2xl font-black">{s?.total ?? "–"}</div><div className="text-[11px] text-muted-foreground">전체 주문</div></div>
          <div><div className="text-2xl font-black">{s?.excel ?? "–"}</div><div className="text-[11px] text-muted-foreground">엑셀로 넣음</div></div>
          <div><div className="text-2xl font-black">{s?.naver ?? "–"}</div><div className="text-[11px] text-muted-foreground">네이버 자동</div></div>
        </div>
        <p className="text-xs text-muted-foreground text-center">마지막 주문일 {s?.last ? String(s.last) : "–"}</p>
      </div>

      {/* 예전 주문 넣기 */}
      <div className={box}>
        <div className="font-bold">📂 예전 주문 넣기 (엑셀 정리 파일)</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          정리해 둔 파일 <b className="text-foreground">1122_구매기록_앱업로드용.txt</b>를 올려 주세요.<br />
          (컴퓨터: D 드라이브 › 26,27 프로젝트 › 한입 › 챌린지_명단 폴더)<br />
          같은 파일을 두 번 올려도 겹치지 않아요.
        </p>
        <input ref={fileRef} type="file" accept=".txt,.tsv,text/plain" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={imp.isPending} className={`${btn} w-full border-primary text-primary`}>
          {imp.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "파일 골라서 넣기"}
        </button>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">엑셀에서 복사해서 붙여 넣기</summary>
          <p className="mt-2">칸 순서: 날짜 · 주문번호 · 구매자 · 구매자전화 · 받는분 · 받는분전화 · 상품 · 옵션 · 수량 · 시트 · 메모 · 구분</p>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4}
            className="mt-2 w-full rounded-xl border border-border bg-transparent p-2 text-sm" placeholder="엑셀에서 줄들을 복사해 붙여 넣기" />
          <button type="button" disabled={!paste.trim() || imp.isPending} onClick={() => imp.mutate({ text: paste })} className={`${btn} w-full mt-2`}>붙여 넣은 것 넣기</button>
        </details>
      </div>

      {/* 네이버 자동 */}
      <div className={box}>
        <div className="font-bold">🟢 네이버 스마트스토어 자동 수집</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {nv?.configured
            ? <>켜져 있어요 · 하루 1번 자동으로 가져와요{nv.proxy ? "" : " (고정 IP 주소가 없어서 실패할 수 있어요)"}</>
            : <>꺼져 있어요 · Railway 설정에 네이버 커머스 API 열쇠를 넣으면 켜져요</>}
          {nv?.lastResult && <><br />마지막: {nv.lastResult}</>}
        </p>
        <button type="button" disabled={!nv?.configured || sync.isPending} onClick={() => sync.mutate()} className={`${btn} w-full`}>
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "지금 네이버에서 가져오기"}
        </button>
      </div>

      {/* 누가 얼마나 샀나 */}
      <div className={box}>
        <div className="grid grid-cols-2 gap-2">
          {([["all", "전체 구매자"], ["crew", "우리 방"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setTab(k); setOpenUser(null); }}
              className={`h-11 rounded-xl border text-sm font-bold ${tab === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="font-bold">🏆 구매 순위</div>
          <div className="flex gap-1">
            {([["all", "전체"], ["year", "올해"], ["3m", "3개월"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPeriod(k)}
                className={`h-8 rounded-lg px-2.5 text-xs font-semibold border ${period === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {tab === "all"
            ? <>전화번호 기준 {rows.length}명 · 그중 앱 가입 {joined}명 · '앱 가입'은 눌러서 자세히</>
            : <>앱에 가입한 크루 {rows.length}명 · 산 적 있는 크루 {bought}명 · 눌러서 자세히</>}
        </p>
        {ranking.isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">아직 구매 기록이 없어요. 위에서 파일을 먼저 넣어 주세요.</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r, i) => (
              <div key={`${r.phoneTail}-${i}`}>
                <button type="button" disabled={!r.userId} onClick={() => setOpenUser(openUser === r.userId ? null : r.userId)}
                  className="w-full flex items-center gap-3 py-2.5 text-left disabled:cursor-default">
                  <span className="w-7 text-center text-sm font-black text-primary">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">
                      {r.nickname ?? r.buyerName ?? "이름 없음"} {r.phoneTail && <span className="text-muted-foreground font-normal">· ****{r.phoneTail}</span>}
                      {tab === "all" && r.userId ? <span className="ml-1.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">앱 가입</span> : null}
                      {tab === "crew" && r.hasPhone === false ? <span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">번호 없음</span> : null}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{r.count > 0 ? <>{r.count}번 · 수량 {r.boxes}{fmtWon(r.amount) && ` · ${fmtWon(r.amount)}`} · 마지막 {r.last ?? "–"}</> : "아직 구매 없음"}</span>
                  </span>
                  {r.userId ? <span className="text-muted-foreground text-sm">{openUser === r.userId ? "▲" : "▼"}</span> : null}
                </button>
                {openUser === r.userId && r.userId && (
                  <div className="pb-3 pl-10 space-y-1">
                    {detail.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (detail.data?.rows ?? []).map((x: any) => (
                      <div key={x.id} className="text-xs text-muted-foreground">
                        {x.orderDate ?? "–"} · {x.kind !== "구매" ? `[${x.kind}] ` : ""}{x.product} {x.opt && `(${x.opt})`} · {x.qty}개{x.asBuyer ? "" : " · 받는 분으로"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
