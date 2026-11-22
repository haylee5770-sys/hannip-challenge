// 꾸미기 맨 아래 (2026-11-22): 💬 의견 보내기 · 🎁 신청하기(선물 신청 / 이벤트 신청)
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

const glass = "w-full rounded-3xl border border-white/20 bg-white/[0.06] backdrop-blur-xl px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition";
const field = "w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none focus:border-primary";

function shrink(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = rej; img.src = r.result as string;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-border p-5 space-y-4 season-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [text, setText] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = trpc.crew.sendFeedback.useMutation({ onSuccess: () => setSent(true), onError: e => toast.error(e.message) });
  const share = async () => {
    const msg = `[${kind === "bug" ? "🐞 오류 발견" : "💡 의견"}] ${text}`;
    try { if (navigator.share) await navigator.share({ text: msg }); else { await navigator.clipboard.writeText(msg); toast.success("글을 복사했어요. 카톡방에 붙여 넣어 주세요."); } } catch { /* 취소 */ }
  };
  if (sent) return (
    <Sheet title="💬 의견 보내기" onClose={onClose}>
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl">💚</div>
        <p className="font-bold">보내 주셔서 고마워요!</p>
        <p className="text-sm text-muted-foreground">크루님 덕분에 앱이 더 좋아져요.</p>
        <button type="button" className={glass + " text-center font-bold"} onClick={share}>카톡방에도 공유하기</button>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={onClose}>닫기</button>
      </div>
    </Sheet>
  );
  return (
    <Sheet title="💬 의견 보내기" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {([["bug", "🐞 오류 발견"], ["idea", "💡 의견 내기"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-2xl border py-3 font-bold ${kind === k ? "glass-fill" : "border-border text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      <textarea className={field + " resize-none"} rows={5} value={text} onChange={e => setText(e.target.value)}
        placeholder={kind === "bug" ? "어디에서 어떤 문제가 있었는지 알려 주세요" : "이러면 좋겠어요! 편하게 적어 주세요"} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setImg(await shrink(f)); }} />
      {img ? (
        <div className="relative"><img src={img} alt="첨부" className="w-full rounded-2xl" /><button type="button" onClick={() => setImg(null)} className="absolute top-2 right-2 rounded-full bg-black/70 p-1"><X className="h-4 w-4" /></button></div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border border-dashed border-border py-4 text-sm text-muted-foreground">📷 캡처 사진 붙이기 (선택)</button>
      )}
      <button type="button" disabled={text.trim().length < 2 || send.isPending} onClick={() => send.mutate({ kind, text, imageDataUrl: img ?? undefined })}
        className="w-full h-12 rounded-2xl glass-btn font-bold disabled:opacity-40">{send.isPending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "보내기"}</button>
    </Sheet>
  );
}

/** 🏆 상 받기 신청: 이게돼 챔피언 · 꾸준함 챔피언 · MVP 중 내 상을 눌러 → 받을 곳 확인 → 신청 */
function AwardSheet({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const opt = trpc.crew.awardOptions.useQuery();
  const [pick, setPick] = useState<{ code: number; title: string; gift: string } | null>(null);
  const [edit, setEdit] = useState(false);
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [saveDefault, setSaveDefault] = useState(false);
  const [done, setDone] = useState(false);
  const req = trpc.crew.request.useMutation({ onSuccess: () => { setDone(true); utils.crew.awardOptions.invalidate(); }, onError: e => toast.error(e.message) });
  const c = opt.data?.contact;
  const season = opt.data?.seasonName ?? "";
  const label = pick ? `${season} ${pick.title} (${pick.gift})`.trim() : "";
  const send = (extra?: { saveAsDefault?: boolean }) => { if (pick) req.mutate({ kind: "gift", refId: pick.code, label, realName: c?.realName ?? "", phone, address, ...extra }); };

  if (done && pick) return (
    <Sheet title="🏆 상 받기 신청" onClose={onClose}>
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl">🎉</div>
        <p className="text-lg font-bold">신청이 완료되었습니다!</p>
        <p className="text-sm text-muted-foreground">{label}<br />방장이 확인하고 보내 드려요.</p>
        <button type="button" className={glass + " text-center font-bold"} onClick={onClose}>닫기</button>
      </div>
    </Sheet>
  );
  if (pick) return (
    <Sheet title="🎁 선물 받으실 곳이 여기 맞나요?" onClose={onClose}>
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm font-semibold">{label}</div>
      {!edit ? (<>
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-sm space-y-1">
          <div><b>{c?.realName}</b> · {phone}</div>
          <div className="text-muted-foreground leading-relaxed">{address || "주소가 없어요. [다른 곳에서 받을래요]를 눌러 적어 주세요."}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="rounded-2xl border border-border py-3 text-sm" onClick={() => setEdit(true)}>다른 곳에서 받을래요</button>
          <button type="button" disabled={!address || req.isPending} className="rounded-2xl glass-btn py-3 font-bold disabled:opacity-40" onClick={() => send()}>네, 맞아요</button>
        </div>
      </>) : (<>
        <div className="space-y-1"><div className="text-xs text-muted-foreground">전화번호</div><input className={field} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" /></div>
        <div className="space-y-1"><div className="text-xs text-muted-foreground">받으실 주소</div><textarea className={field + " resize-none"} rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="친정집 등 받으실 곳 (동·호수까지)" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveDefault} onChange={e => setSaveDefault(e.target.checked)} /> 앞으로도 이 주소로 받을게요</label>
        <p className="text-xs text-primary">이 번호와 주소로 선물이 가요. 한 번 더 확인해 주세요.</p>
        <button type="button" disabled={phone.replace(/\D/g, "").length < 10 || address.trim().length < 5 || req.isPending} className="w-full h-12 rounded-2xl glass-btn font-bold disabled:opacity-40"
          onClick={() => send({ saveAsDefault: saveDefault })}>이 주소로 신청하기</button>
      </>)}
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setPick(null)}>뒤로</button>
    </Sheet>
  );
  return (
    <Sheet title="🏆 상 받기 신청" onClose={onClose}>
      <p className="text-sm text-muted-foreground">{season ? <><b className="text-foreground">{season}</b> 시상식에서 상을 받으셨나요?</> : "시상식에서 상을 받으셨나요?"}<br />내 상을 눌러 주세요.</p>
      {opt.isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
        <div className="space-y-3">
          {(opt.data?.awards ?? []).map(a => (
            <button key={a.code} type="button" disabled={a.requested}
              onClick={() => { setPick(a); setEdit(false); setPhone(c?.phone ?? ""); setAddress(c?.address ?? ""); }}
              className={glass + " disabled:opacity-50"}>
              <div className="text-xs text-primary font-semibold">{a.title}은 여기를 눌러 주세요</div>
              <div className="text-xl font-black mt-0.5">🏆 {a.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{a.requested ? "신청 완료 ✓" : `🎁 ${a.gift}`}</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** 🎉 이벤트 참여: 열린 이벤트를 누르면 바로 신청 완료 + 신청한 순서대로 이름이 릴레이로 쌓임. 지난 이벤트는 날짜별로 아래에 */
function EventSheet({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const board = trpc.crew.eventBoard.useQuery(undefined, { refetchInterval: 5000 });
  const [openId, setOpenId] = useState<number | null>(null);
  const [justJoined, setJustJoined] = useState(false);
  const join = trpc.crew.joinEvent.useMutation({
    onSuccess: (r: any) => { if (r?.ok === false) toast.error(r.message); else setJustJoined(true); utils.crew.eventBoard.invalidate(); utils.crew.eventApplicants.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const people = trpc.crew.eventApplicants.useQuery({ eventId: openId ?? 0 }, { enabled: !!openId, refetchInterval: 4000 });
  const evs = board.data ?? [];
  const ev = evs.find(e => e.id === openId);

  if (ev) return (
    <Sheet title="🎉 이벤트 참여" onClose={onClose}>
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
        <div className="font-bold">{ev.title}</div>
        <div className="text-xs text-muted-foreground">{ev.date} · {ev.open ? "진행 중" : "마감"}</div>
      </div>
      {justJoined && <div className="text-center py-2 season-fade-in"><div className="text-4xl">✅</div><div className="text-lg font-bold mt-1">신청이 완료되었습니다!</div></div>}
      <div className="text-sm font-semibold">신청자 {people.data?.length ?? 0}명 <span className="text-[11px] text-muted-foreground font-normal">· 신청한 순서대로</span></div>
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
        {(people.data ?? []).map(p => (
          <div key={p.no} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 season-fade-in">
            <span className="w-7 text-center text-primary font-black tabular-nums">{p.no}</span><span className="font-semibold">{p.name}</span>
          </div>
        ))}
      </div>
      {ev.open && !ev.joined && !justJoined && (
        <button type="button" disabled={join.isPending} className="w-full h-12 rounded-2xl glass-btn font-bold" onClick={() => join.mutate({ eventId: ev.id })}>나도 신청하기</button>
      )}
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => { setOpenId(null); setJustJoined(false); }}>이벤트 목록</button>
    </Sheet>
  );
  const open = evs.filter(e => e.open), past = evs.filter(e => !e.open);
  return (
    <Sheet title="🎉 이벤트 참여" onClose={onClose}>
      {board.isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : open.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">지금은 열린 이벤트가 없어요.<br />방장이 이벤트를 열면 여기에 떠요.</p>
      ) : (
        <div className="space-y-3">
          {open.map(e => (
            <button key={e.id} type="button" className={glass}
              onClick={() => { setOpenId(e.id); setJustJoined(false); if (!e.joined) join.mutate({ eventId: e.id }); }}>
              <div className="text-lg font-black">{e.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{e.date} · 신청 {e.count}명 · {e.joined ? "신청 완료 ✓ (눌러서 명단 보기)" : "누르면 바로 신청돼요"}</div>
            </button>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <div className="text-xs text-muted-foreground font-semibold">지난 이벤트</div>
          {past.map(e => (
            <button key={e.id} type="button" onClick={() => { setOpenId(e.id); setJustJoined(false); }} className="w-full flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm text-left">
              <span className="truncate">{e.date} · {e.title}</span><span className="text-xs text-muted-foreground shrink-0 ml-2">{e.count}명</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export default function CrewButtons() {
  const [open, setOpen] = useState<null | "fb" | "award" | "event">(null);
  return (
    <section className="space-y-3 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={glass + " text-center py-6"} onClick={() => setOpen("award")}>
          <div className="text-3xl">🏆</div><div className="text-base font-black mt-1">상 받기 신청</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">시상식 수상자</div>
        </button>
        <button type="button" className={glass + " text-center py-6"} onClick={() => setOpen("event")}>
          <div className="text-3xl">🎉</div><div className="text-base font-black mt-1">이벤트 참여</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">누르면 바로 신청</div>
        </button>
      </div>
      <button type="button" className={glass} onClick={() => setOpen("fb")}>
        <div className="text-base font-bold">💬 의견 보내기</div>
        <div className="text-xs text-muted-foreground mt-0.5">오류를 발견했거나, 이러면 좋겠다 싶을 때</div>
      </button>
      {open === "fb" && <FeedbackSheet onClose={() => setOpen(null)} />}
      {open === "award" && <AwardSheet onClose={() => setOpen(null)} />}
      {open === "event" && <EventSheet onClose={() => setOpen(null)} />}
    </section>
  );
}
