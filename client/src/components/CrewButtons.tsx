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

function RequestSheet({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const opt = trpc.crew.myOptions.useQuery();
  const [tab, setTab] = useState<"gift" | "event">("gift");
  const [pick, setPick] = useState<{ kind: "gift" | "event"; refId: number; label: string } | null>(null);
  const [edit, setEdit] = useState(false);
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [saveDefault, setSaveDefault] = useState(false);
  const req = trpc.crew.request.useMutation({ onSuccess: () => { toast.success("신청했어요! 방장이 확인하고 보내 드려요 🎁"); utils.crew.myOptions.invalidate(); setPick(null); }, onError: e => toast.error(e.message) });
  const c = opt.data?.contact;
  const startPick = (p: { kind: "gift" | "event"; refId: number; label: string }) => { setPick(p); setEdit(false); setPhone(c?.phone ?? ""); setAddress(c?.address ?? ""); };

  if (pick) return (
    <Sheet title="🎁 선물 받으실 곳이 여기 맞나요?" onClose={onClose}>
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm font-semibold">{pick.label}</div>
      {!edit ? (<>
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-sm space-y-1">
          <div><b>{c?.realName}</b> · {phone}</div>
          <div className="text-muted-foreground leading-relaxed">{address || "주소가 없어요. '다른 곳에서 받을래요'를 눌러 적어 주세요."}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="rounded-2xl border border-border py-3 text-sm" onClick={() => setEdit(true)}>다른 곳에서 받을래요</button>
          <button type="button" disabled={!address || req.isPending} className="rounded-2xl glass-btn py-3 font-bold disabled:opacity-40"
            onClick={() => req.mutate({ ...pick, realName: c?.realName ?? "", phone, address })}>네, 맞아요</button>
        </div>
      </>) : (<>
        <div className="space-y-1"><div className="text-xs text-muted-foreground">전화번호</div><input className={field} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" /></div>
        <div className="space-y-1"><div className="text-xs text-muted-foreground">받으실 주소</div><textarea className={field + " resize-none"} rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="친정집 등 받으실 곳 (동·호수까지)" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveDefault} onChange={e => setSaveDefault(e.target.checked)} /> 앞으로도 이 주소로 받을게요</label>
        <p className="text-xs text-primary">이 번호와 주소로 선물이 가요. 한 번 더 확인해 주세요.</p>
        <button type="button" disabled={phone.replace(/\D/g, "").length < 10 || address.trim().length < 5 || req.isPending} className="w-full h-12 rounded-2xl glass-btn font-bold disabled:opacity-40"
          onClick={() => req.mutate({ ...pick, realName: c?.realName ?? "", phone, address, saveAsDefault: saveDefault })}>이 주소로 신청하기</button>
      </>)}
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setPick(null)}>뒤로</button>
    </Sheet>
  );

  const gifts = opt.data?.gifts ?? [];
  const events = opt.data?.events ?? [];
  const mine = new Set(opt.data?.myEventIds ?? []);
  return (
    <Sheet title="🎁 신청하기" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {([["gift", "선물 신청"], ["event", "이벤트 신청"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-2xl border py-3 font-bold ${tab === k ? "glass-fill" : "border-border text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {opt.isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : tab === "gift" ? (
        gifts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">지금은 받을 선물이 없어요.<br />시상식에서 뽑히면 여기서 신청할 수 있어요 🏆</p> : (
          <div className="space-y-2">{gifts.map(g => (
            <button key={g.awardId} type="button" disabled={g.requested} onClick={() => startPick({ kind: "gift", refId: g.awardId, label: `🏆 ${g.label}` })} className={glass + " disabled:opacity-50"}>
              <div className="font-bold">🏆 {g.label}</div><div className="text-xs text-muted-foreground mt-0.5">{g.requested ? "신청 완료 ✓" : "눌러서 선물 신청"}</div>
            </button>))}</div>)
      ) : (
        events.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">지금은 열린 이벤트가 없어요.<br />이벤트가 열리면 여기서 신청해요.</p> : (
          <div className="space-y-2">{events.map((ev: any) => (
            <button key={ev.id} type="button" disabled={mine.has(Number(ev.id))} onClick={() => startPick({ kind: "event", refId: Number(ev.id), label: ev.title })} className={glass + " disabled:opacity-50"}>
              <div className="font-bold">{ev.title}</div><div className="text-xs text-muted-foreground mt-0.5">{mine.has(Number(ev.id)) ? "신청 완료 ✓" : "눌러서 신청"}</div>
            </button>))}</div>)
      )}
    </Sheet>
  );
}

export default function CrewButtons() {
  const [open, setOpen] = useState<null | "fb" | "req">(null);
  return (
    <section className="space-y-3 pt-4">
      <button type="button" className={glass} onClick={() => setOpen("fb")}>
        <div className="text-lg font-bold">💬 의견 보내기</div>
        <div className="text-xs text-muted-foreground mt-0.5">오류를 발견했거나, 이러면 좋겠다 싶을 때</div>
      </button>
      <button type="button" className={glass} onClick={() => setOpen("req")}>
        <div className="text-lg font-bold">🎁 신청하기</div>
        <div className="text-xs text-muted-foreground mt-0.5">선물 신청 · 이벤트 신청 (전화번호·주소는 자동으로 들어가요)</div>
      </button>
      {open === "fb" && <FeedbackSheet onClose={() => setOpen(null)} />}
      {open === "req" && <RequestSheet onClose={() => setOpen(null)} />}
    </section>
  );
}
