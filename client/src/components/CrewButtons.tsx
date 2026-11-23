// 꾸미기 맨 아래 (2026-11-22): 💬 의견 보내기 · 🎁 신청하기(선물 신청 / 이벤트 신청)
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import AddressField from "./AddressField";
import { askConfirm } from "@/lib/askConfirm";

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

function Sheet({ title, onClose, children, inline }: { title: string; onClose: () => void; children: React.ReactNode; inline?: boolean }) {
  // 2026-11-22: 메뉴에서 연 페이지면 화면 그대로(팝업 아님)
  if (inline) return (
    <div className="max-w-md mx-auto space-y-4 season-fade-in">
      <h1 className="text-2xl font-black">{title}</h1>
      {children}
    </div>
  );
  return (
    <div className="fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-border p-5 space-y-4 season-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function FeedbackSheet({ onClose, inline }: { onClose: () => void; inline?: boolean }) {
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [text, setText] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const send = trpc.crew.sendFeedback.useMutation({ onSuccess: () => { setSent(true); utils.crew.myFeedbacks.invalidate(); }, onError: e => toast.error(e.message) });
  const again = () => { setText(""); setImg(null); setSent(false); };
  const share = async () => {
    const msg = `[${kind === "bug" ? "🐞 오류 발견" : "💡 의견"}] ${text}`;
    try { if (navigator.share) await navigator.share({ text: msg }); else { await navigator.clipboard.writeText(msg); toast.success("글을 복사했어요. 카톡방에 붙여 넣어 주세요."); } } catch { /* 취소 */ }
  };
  if (sent) return (
    <Sheet inline={inline} title="💬 의견 보내기" onClose={onClose}>
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl">💚</div>
        <p className="font-bold">보내 주셔서 고마워요!</p>
        <p className="text-sm text-muted-foreground">크루님 덕분에 앱이 더 좋아져요.</p>
        <button type="button" className={glass + " text-center font-bold"} onClick={share}>카톡방에도 공유하기</button>
        <button type="button" className={glass + " text-center font-bold"} onClick={again}>✏️ 의견 하나 더 보내기</button>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={onClose}>닫기</button>
      </div>
      <MyFeedbacks />
    </Sheet>
  );
  return (
    <Sheet inline={inline} title="💬 의견 보내기" onClose={onClose}>
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
      <MyFeedbacks />
    </Sheet>
  );
}

/** 내가 보낸 의견 (2026-11-23): 아래에 차곡차곡 쌓이고, 누르면 고칠 수 있다 */
function MyFeedbacks() {
  const list = trpc.crew.myFeedbacks.useQuery();
  const [openId, setOpenId] = useState<number | null>(null);
  const rows = (list.data ?? []) as any[];
  // 2026-11-23: 방장 답장 — 이 화면을 열면 '봤음'으로. 지금 화면에서는 '새 답장' 표시를 그대로 보여 준다
  const utils = trpc.useUtils();
  const seen = trpc.crew.feedbackRepliesSeen.useMutation({ onSuccess: () => utils.crew.unseenReplies.invalidate() });
  const [freshIds] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    const fresh = rows.filter(r => r.reply && !r.replySeen);
    if (fresh.length) { fresh.forEach(r => freshIds.add(r.id)); seen.mutate(); }
  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return null;
  return (
    <div className="pt-4 space-y-2">
      <div className="text-sm font-bold">📮 내가 보낸 의견 <span className="text-muted-foreground font-normal">{rows.length}개 · 눌러서 고칠 수 있어요</span></div>
      {rows.map(r => openId === r.id
        ? <FeedbackEdit key={r.id} row={r} onDone={() => setOpenId(null)} />
        : (
          <button key={r.id} type="button" onClick={() => setOpenId(r.id)}
            className="w-full text-left rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 space-y-1 active:scale-[0.99] transition">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{r.kind === "bug" ? "🐞 오류 발견" : "💡 의견"} · {new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              <span className={r.done ? "text-primary font-semibold" : ""}>{r.done ? "✓ 방장 확인" : "✏️ 고치기"}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{r.text}</div>
            {r.imageUrl && <img src={r.imageUrl} alt="첨부" className="mt-1 max-h-32 rounded-xl" />}
            {r.reply && (
              <div className="mt-2 rounded-xl bg-primary/10 border border-primary/30 p-2.5">
                <div className="text-[11px] font-bold text-primary mb-0.5">💚 방장 답장 {freshIds.has(r.id) && <span className="ml-1 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">새 답장</span>}</div>
                <div className="text-sm whitespace-pre-wrap break-words">{r.reply}</div>
              </div>
            )}
          </button>
        ))}
    </div>
  );
}

function FeedbackEdit({ row, onDone }: { row: any; onDone: () => void }) {
  const [kind, setKind] = useState<"bug" | "idea">(row.kind === "idea" ? "idea" : "bug");
  const [text, setText] = useState<string>(row.text ?? "");
  const [img, setImg] = useState<string | null>(row.imageUrl ?? null);
  const [newImg, setNewImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const save = trpc.crew.editFeedback.useMutation({
    onSuccess: () => { utils.crew.myFeedbacks.invalidate(); toast.success("의견을 고쳤어요."); onDone(); },
    onError: e => toast.error(e.message),
  });
  const del = trpc.crew.deleteFeedback.useMutation({
    onSuccess: () => { utils.crew.myFeedbacks.invalidate(); toast.success("의견을 지웠어요."); onDone(); },
    onError: e => toast.error(e.message),
  });
  return (
    <div className="rounded-2xl border border-primary/60 bg-white/[0.04] p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([["bug", "🐞 오류 발견"], ["idea", "💡 의견 내기"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-2xl border py-2 text-sm font-bold ${kind === k ? "glass-fill" : "border-border text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      <textarea className={field + " resize-none"} rows={5} value={text} onChange={e => setText(e.target.value)} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { const d = await shrink(f); setImg(d); setNewImg(d); } }} />
      {img ? (
        <div className="relative"><img src={img} alt="첨부" className="w-full rounded-2xl" /><button type="button" onClick={() => { setImg(null); setNewImg(null); }} className="absolute top-2 right-2 rounded-full bg-black/70 p-1"><X className="h-4 w-4" /></button></div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground">📷 캡처 사진 붙이기 (선택)</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} className="h-11 rounded-2xl border border-border text-sm font-bold text-muted-foreground">취소</button>
        <button type="button" disabled={text.trim().length < 2 || save.isPending}
          onClick={() => save.mutate({ id: row.id, kind, text, imageDataUrl: newImg ?? undefined, removeImage: !img && !!row.imageUrl })}
          className="h-11 rounded-2xl glass-btn text-sm font-bold disabled:opacity-40">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "고친 내용 저장"}</button>
      </div>
      {/* 2026-11-23: 방장이 아직 확인·답장 안 한 의견만 지울 수 있어요 */}
      {!row.done && !row.reply ? (
        <button type="button" disabled={del.isPending}
          onClick={async () => { if (await askConfirm("이 의견을 지울까요?\n지우면 되돌릴 수 없어요.", "삭제")) del.mutate({ id: row.id }); }}
          className="w-full h-10 rounded-2xl border border-destructive/50 text-sm font-bold text-destructive disabled:opacity-40">
          {del.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "🗑 의견 삭제"}
        </button>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">방장이 이미 확인한 의견이라 지울 수 없어요.</p>
      )}
    </div>
  );
}

/** 🏆 상 받기 신청: 이게돼 챔피언 · 꾸준함 챔피언 · MVP 중 내 상을 눌러 → 받을 곳 확인 → 신청 */
export function AwardSheet({ onClose, inline }: { onClose: () => void; inline?: boolean }) {
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
    <Sheet inline={inline} title="🏆 상 받기 신청" onClose={onClose}>
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl">🎉</div>
        <p className="text-lg font-bold">신청이 완료되었습니다!</p>
        <p className="text-sm text-muted-foreground">{label}<br />방장이 확인하고 보내 드려요.</p>
        <button type="button" className={glass + " text-center font-bold"} onClick={onClose}>닫기</button>
      </div>
    </Sheet>
  );
  if (pick) return (
    <Sheet inline={inline} title="🎁 선물 받으실 곳이 여기 맞나요?" onClose={onClose}>
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
        <div className="space-y-1"><div className="text-xs text-muted-foreground">받으실 주소</div><AddressField value={address} onChange={setAddress} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveDefault} onChange={e => setSaveDefault(e.target.checked)} /> 앞으로도 이 주소로 받을게요</label>
        <p className="text-xs text-primary">이 번호와 주소로 선물이 가요. 한 번 더 확인해 주세요.</p>
        <button type="button" disabled={phone.replace(/\D/g, "").length < 10 || address.trim().length < 5 || req.isPending} className="w-full h-12 rounded-2xl glass-btn font-bold disabled:opacity-40"
          onClick={() => send({ saveAsDefault: saveDefault })}>이 주소로 신청하기</button>
      </>)}
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setPick(null)}>뒤로</button>
    </Sheet>
  );
  return (
    <Sheet inline={inline} title="🏆 상 받기 신청" onClose={onClose}>
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
export function EventSheet({ onClose, inline }: { onClose: () => void; inline?: boolean }) {
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
    <Sheet inline={inline} title="🎉 이벤트 신청" onClose={onClose}>
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
    <Sheet inline={inline} title="🎉 이벤트 신청" onClose={onClose}>
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
  const unseen = trpc.crew.unseenReplies.useQuery(undefined, { staleTime: 60_000 });
  return (
    <section className="space-y-3 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={glass + " text-center py-6"} onClick={() => setOpen("award")}>
          <div className="text-3xl">🏆</div><div className="text-base font-black mt-1">상 받기 신청</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">시상식 수상자</div>
        </button>
        <button type="button" className={glass + " text-center py-6"} onClick={() => setOpen("event")}>
          <div className="text-3xl">🎉</div><div className="text-base font-black mt-1">이벤트 신청</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">누르면 바로 신청</div>
        </button>
      </div>
      {/* 2026-11-23 해이: 위 두 버튼만큼 높게 */}
      <button type="button" className={glass + " text-center py-6"} onClick={() => setOpen("fb")}>
        <div className="text-3xl">💬</div>
        <div className="text-base font-black mt-1">의견 보내기 {(unseen.data ?? 0) > 0 && <span className="ml-1 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] text-white align-middle">새 답장 {unseen.data}</span>}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">오류를 발견했거나, 이러면 좋겠다 싶을 때</div>
      </button>
      {open === "fb" && <FeedbackSheet onClose={() => setOpen(null)} />}
      {open === "award" && <AwardSheet onClose={() => setOpen(null)} />}
      {open === "event" && <EventSheet onClose={() => setOpen(null)} />}
    </section>
  );
}
