// 이게돼 — 나의 후기를 쓰고 카톡방에 자랑, 나와 크루들의 이게돼가 바둑판으로 쌓임 (2026-11-20)
// 올리면 수정 불가 · 이게돼 챔피언 = 회차 동안 이게돼를 가장 많이 쓴 사람
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { shareProof } from "@/lib/proofCard";

type Note = { id: number; userId: number; recordedDate: string; content: string; summary: string; createdAt: string };
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

function Grid({ notes, onOpen }: { notes: Note[]; onOpen: (n: Note) => void }) {
  if (!notes.length) return <p className="text-sm text-muted-foreground py-4 text-center">아직 이게돼가 없어요.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {notes.map(n => {
        const [, m, d] = n.recordedDate.split("-").map(Number);
        return (
          <button key={n.id} type="button" onClick={() => onOpen(n)} className="aspect-square rounded-xl bg-card border border-border p-2 text-left flex flex-col hover:border-primary/60">
            <span className="text-[11px] text-primary font-semibold">{m}/{d} 이게돼</span>
            <span className="text-xs mt-1 leading-snug line-clamp-4">{n.summary || n.content}</span>
          </button>
        );
      })}
    </div>
  );
}

function Pop({ note, name, onClose }: { note: Note | null; name?: string; onClose: () => void }) {
  if (!note) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border p-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-2">
          <div><div className="text-primary font-semibold">#이게돼</div><div className="text-xs text-muted-foreground">{name ? `${name} · ` : ""}{note.createdAt}</div></div>
          <button type="button" onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{note.content}</p>
      </div>
    </div>
  );
}

export default function Itge() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const mine = trpc.itge.mine.useQuery();
  const crew = trpc.itge.crew.useQuery();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<{ note: Note; name?: string } | null>(null);
  const [crewUser, setCrewUser] = useState<{ userId: number; name: string } | null>(null);
  const crewNotes = trpc.itge.byUser.useQuery({ userId: crewUser?.userId ?? 0 }, { enabled: !!crewUser });

  const create = trpc.itge.create.useMutation({
    onSuccess: (r) => {
      const body = text.trim();
      setText("");
      utils.itge.mine.invalidate(); utils.itge.crew.invalidate();
      toast.success("이게돼가 올라갔어요 💚");
      shareProof({
        emoji: "✨", title: "이게돼", lines: [], userName: user?.name ?? "", date: todayKst(),
        itemLabel: "이게돼", count: r.count, body, avatar: (user as any)?.avatarUrl ?? null,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }),
      }).catch(() => {});
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="text-center">
        <div className="editorial-eyebrow text-primary mb-1">#이게돼</div>
        <h1 className="text-3xl md:text-4xl font-semibold">이게 된다고?</h1>
        <p className="mt-2 text-sm text-muted-foreground">나의 변화, 오늘의 작은 성공을 남겨 주세요. 올리면 카톡방에 자랑돼요.</p>
      </section>

      <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={5} maxLength={3000}
          placeholder="#이게돼 — 예) 스무디 3일 했더니 아침 붓기가 쏙 빠졌어요!" className="rounded-xl bg-transparent" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">올리기 전까지만 고칠 수 있어요. 올리면 수정 불가.</span>
          <Button className="ml-auto glass-btn h-11 px-7" disabled={create.isPending || text.trim().length < 2}
            onClick={() => create.mutate({ date: todayKst(), content: text.trim() })}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "자랑하기"}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">나의 이게돼 <span className="text-primary">{mine.data?.length ?? 0}</span></h2>
        <Grid notes={(mine.data ?? []) as Note[]} onOpen={n => setOpen({ note: n })} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">크루들의 이게돼</h2>
        <div className="grid grid-cols-5 gap-2">
          {(crew.data ?? []).filter(c => c.userId !== user?.id).map(c => (
            <button key={c.userId} type="button" onClick={() => setCrewUser({ userId: c.userId, name: c.name })}
              className="aspect-square rounded-full border border-primary/50 bg-primary/10 flex flex-col items-center justify-center p-1">
              <span className="text-[11px] font-semibold leading-tight text-center line-clamp-2">{c.name}</span>
              <span className="text-[10px] text-primary">{c.count}</span>
            </button>
          ))}
        </div>
      </section>

      {crewUser && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={() => setCrewUser(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-background border border-border p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><h3 className="text-lg font-semibold">{crewUser.name}의 이게돼</h3><button type="button" onClick={() => setCrewUser(null)}><X className="h-5 w-5" /></button></div>
            {crewNotes.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Grid notes={(crewNotes.data ?? []) as Note[]} onOpen={n => setOpen({ note: n, name: crewUser.name })} />}
          </div>
        </div>
      )}
      <Pop note={open?.note ?? null} name={open?.name} onClose={() => setOpen(null)} />
    </div>
  );
}
