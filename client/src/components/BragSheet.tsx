// 자랑하기 창 (2026-11-24 해이)
// 예전: 자랑하기를 누르면 '저장'과 '카톡 공유창'을 동시에 → 카톡으로 넘어가는 순간 휴대폰이 앱을 재워서 저장이 끊기거나,
//       사진 만드는 사이 '누른 직후'가 지나 공유창이 막혀 여러 번 눌러야 했다.
// 지금: ① 인증 버튼을 누르면 저장부터 하고 이 창이 뜬다 ② 그동안 인증 카드 사진을 미리 만들어 둔다
//       ③ 저장이 끝나면 [카톡에 자랑하기]가 켜지고, 누르자마자 글 복사 + 공유창. 깜빡해도 '⏳ 자랑 전'으로 남는다.
import { useEffect, useRef, useState } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { isIOS, makeProofBlobs, savePhotosToPhone, shareImages, shareTextOf, type ProofCard } from "@/lib/proofCard";
import { kstToday, listPending, openBrag, removePending } from "@/lib/bragQueue";
import { trpc } from "@/lib/trpc";

const BRAG_KIND: Record<string, "meal" | "water" | "exercise" | "wake" | "weight" | "itge"> = {
  "물": "water", "식단": "meal", "스무디": "meal", "일반식": "meal", "운동": "exercise", "기상": "wake", "체중": "weight", "이게돼": "itge",
};

export default function BragSheet() {
  const [cur, setCur] = useState<{ card: ProofCard; key: string } | null>(null);
  const [blobs, setBlobs] = useState<Blob[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]); // 2026-11-24: 이게돼처럼 여러 장이면 전부 보여 준다
  const [failed, setFailed] = useState(false);
  const [saveIdx, setSaveIdx] = useState(0);
  const saving = useIsMutating() > 0;
  const qc = useQueryClient();
  const openedAt = useRef(0);
  const savedAt = useRef(0); // 인증 저장을 누른 시각 (자랑하면 그 무렵 저장된 기록을 '자랑함'으로)
  const markedKey = useRef<string | null>(null);
  const markBragged = trpc.rounds.markBragged.useMutation({ onSuccess: () => qc.invalidateQueries() });

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { card: ProofCard; key: string };
      setCur(d); setBlobs(null); setFailed(false); setSaveIdx(0); openedAt.current = Date.now();
      savedAt.current = listPending().find(p => p.key === d.key)?.at ?? Date.now();
      setPreviews([]);
      makeProofBlobs(d.card).then(b => { setBlobs(b); setPreviews(b.map(x => URL.createObjectURL(x))); }).catch(() => setBlobs([]));
    };
    window.addEventListener("hannip-brag-open", h);
    return () => window.removeEventListener("hannip-brag-open", h);
  }, []);
  useEffect(() => () => { previews.forEach(u => URL.revokeObjectURL(u)); }, [previews]);

  // 창이 떠 있는 동안 저장이 실패하면: 자랑 대기에서 빼고 다시 하라고 알림
  useEffect(() => {
    if (!cur) return;
    return qc.getMutationCache().subscribe(ev => {
      const m: any = (ev as any).mutation;
      if (ev.type === "updated" && m?.state?.status === "error" && (m.state.submittedAt ?? 0) >= openedAt.current - 3000) {
        setFailed(true); removePending(cur.key);
      }
    });
  }, [cur, qc]);

  if (!cur) return null;
  const close = () => setCur(null);
  const text = shareTextOf(cur.card);
  const base = `hannip_${cur.card.date}`;
  // 2026-11-28 해이: 그날 밤 12시가 지나면 자랑해도 누적에 안 들어간다
  const expired = cur.card.date !== kstToday();
  const ready = !!blobs?.length && !saving && !failed && !expired;

  const brag = async () => {
    if (!blobs?.length || expired) return;
    const r = await shareImages(blobs, text, base); // 글 복사 + 공유창이 누르자마자 열림 (사진은 이미 만들어 둠)
    if (r === "blocked") { toast.error("한 번만 더 눌러 주세요."); return; }
    // 2026-11-25 해이: 단톡방에 자랑(공개)해야 누적·합계·순위에 들어간다
    // 2026-11-28: 카톡에 잘 올려도 휴대폰(기종·카톡 버전)에 따라 '공유 취소'로 알려 오는 경우가 있어,
    // 공유창이 열렸으면 자랑한 것으로 센다 (누적이 날마다 1로 돌아가던 문제)
    const kind = BRAG_KIND[cur.card.itemLabel ?? ""];
    // 같은 인증을 두 번 눌러도 한 번만 센다
    if (kind && markedKey.current !== cur.key) { markedKey.current = cur.key; markBragged.mutate({ kind, date: cur.card.date, n: cur.card.add ?? 1 }); removePending(cur.key); }
    if (r !== "cancelled") { removePending(cur.key); close(); }
  };
  // 2026-11-24 해이: 여러 장을 한꺼번에 내려받으면 갤럭시가 "여러 파일 다운로드" 허용 창을 띄움 → 한 번 누를 때 한 장씩
  const keep = async () => {
    if (!blobs?.length) return;
    if (isIOS() || blobs.length === 1) {
      const r = await savePhotosToPhone(blobs, base);
      if (r === "saved") toast.success("내 폰에 저장했어요. 갤러리의 'Download' 앨범에 있어요.");
      return;
    }
    const i = Math.min(saveIdx, blobs.length - 1);
    await savePhotosToPhone([blobs[i]], `${base}_${i + 1}`);
    const next = i + 1;
    setSaveIdx(next);
    toast.success(next < blobs.length ? `${next}장 저장했어요. 한 번 더 누르면 ${next + 1}번째 장도 저장돼요.` : "모두 저장했어요. 갤러리의 'Download' 앨범에 있어요.");
  };

  return (
    <div className="fixed inset-0 z-[105] bg-black/75 flex items-end sm:items-center justify-center" onClick={close}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-border p-5 space-y-3 season-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {failed ? "⚠️ 저장이 안 됐어요" : saving ? "저장하는 중이에요…" : "✅ 인증 저장 완료!"}
          </h2>
          <button type="button" onClick={close} aria-label="닫기"><X className="h-5 w-5" /></button>
        </div>
        {failed ? (
          <p className="text-sm text-muted-foreground">기록이 남지 않았어요. 창을 닫고 인증을 한 번 더 해 주세요.</p>
        ) : (<>
          {previews.length > 1 && <p className="text-center text-sm font-bold text-primary">사진 {previews.length}장이 한 번에 올라가요 · 옆으로 넘겨 보세요 👉</p>}
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory">
            {previews.length ? previews.map((u, i) => (
              <div key={u} className="relative shrink-0 w-full snap-center rounded-2xl overflow-hidden border border-border bg-black/30 aspect-[4/5]">
                <img src={u} alt={`인증 사진 ${i + 1}`} className="w-full h-full object-contain allow-save" />
                {previews.length > 1 && <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{i + 1}/{previews.length}</span>}
              </div>
            )) : <div className="w-full aspect-[4/5] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          </div>
          <button type="button" disabled={!ready} onClick={brag}
            className="w-full h-14 rounded-2xl glass-btn text-lg font-black disabled:opacity-50 nudge">
            {expired ? "날짜가 지나서 자랑할 수 없어요" : ready ? "💚 카톡에 자랑하기" : <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> 저장하는 중…</span>}
          </button>
          {expired && <p className="text-center text-xs font-bold text-amber-300">자랑은 인증한 날 밤 12시까지만 할 수 있어요. 이 인증은 누적에 들어가지 않아요.</p>}
          <p className="text-center text-[11px] text-muted-foreground">누르면 글이 복사돼요. 사진을 올린 뒤 입력칸을 길게 눌러 '붙여넣기' 해 주세요.</p>
          <button type="button" disabled={!blobs?.length} onClick={keep}
            className="w-full h-11 rounded-2xl border border-border text-sm font-bold disabled:opacity-50">
            {blobs && blobs.length > 1 && !isIOS()
              ? (saveIdx >= blobs.length ? "✓ 모두 저장했어요" : `📥 내 폰에 저장 (${saveIdx + 1}/${blobs.length}장)`)
              : "📥 인증 사진 내 폰에 저장"}</button>
          <button type="button" onClick={close} className="w-full text-sm text-muted-foreground underline">나중에 자랑할게요 (⏳ 자랑 전으로 남아요)</button>
        </>)}
      </div>
    </div>
  );
}

/** 오늘 화면 위: 아직 자랑 안 한 인증 (⏳ 자랑 전) — 누르면 자랑 창이 다시 뜬다 */
export function PendingBrags({ date }: { date: string }) {
  const [list, setList] = useState(() => listPending());
  useEffect(() => {
    const h = () => setList(listPending());
    window.addEventListener("hannip-pending-change", h);
    return () => window.removeEventListener("hannip-pending-change", h);
  }, []);
  const mine = list.filter(p => p.card.date === date);
  if (!mine.length) return null;
  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400/70 bg-amber-400/10 p-3 space-y-2">
      <div className="text-sm font-bold text-amber-300">⏳ 아직 자랑 안 한 인증 {mine.length}개 · 눌러서 자랑해 주세요</div>
      <div className="flex flex-wrap gap-2">
        {mine.map(p => (
          <div key={p.key} className="flex items-center gap-1">
            <button type="button" onClick={() => openBrag(p.card, p.key)}
              className="rounded-full border border-amber-400 bg-card px-3 py-1.5 text-sm font-bold">
              {p.card.emoji} {p.card.itemLabel ?? p.card.title}{p.card.count != null ? ` ${p.card.count}` : ""} · 자랑 전
            </button>
            <button type="button" aria-label="지우기" onClick={() => removePending(p.key)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
