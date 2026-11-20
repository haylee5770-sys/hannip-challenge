// 역대 챌린지 (2026-11-20) — 끝난 회차들의 수상자 앨범. 방장은 이름·수상자를 고칠 수 있음.
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

type A = { id: number; userId: number; name: string; count: number; rankNo: number };

export default function History() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const q = trpc.rounds.history.useQuery();
  const upd = trpc.rounds.updateAward.useMutation({ onSuccess: () => { utils.rounds.history.invalidate(); toast.success("고쳤어요"); } });
  const ren = trpc.rounds.rename.useMutation({ onSuccess: () => { utils.rounds.history.invalidate(); toast.success("고쳤어요"); } });

  const Row = ({ a, unit }: { a: A; unit: string }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6">{["🥇", "🥈", "🥉"][a.rankNo - 1] ?? a.rankNo}</span>
      <span className="flex-1">{a.name}</span>
      <span className="text-primary tabular-nums">{a.count}{unit}</span>
      {isAdmin && <button type="button" onClick={() => { const n = prompt("수상자 이름", a.name); if (n && n.trim()) upd.mutate({ id: a.id, name: n.trim() }); }} className="text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="text-center pb-2">
        <div className="editorial-eyebrow text-primary mb-1">HALL OF FAME</div>
        <h1 className="text-3xl md:text-4xl font-semibold">역대 챌린지</h1>
      </section>
      {q.isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : (q.data ?? []).length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">아직 끝난 회차가 없어요.</p>
        : (q.data ?? []).map(s => (
          <section key={s.id} className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold flex-1">{s.name}</h2>
              {isAdmin && <button type="button" onClick={() => { const n = prompt("회차 이름", s.name); if (n && n.trim()) ren.mutate({ seasonId: s.id, name: n.trim() }); }} className="text-muted-foreground"><Pencil className="h-4 w-4" /></button>}
            </div>
            <div className="text-xs text-muted-foreground mb-3">{s.startDate} ~ {s.endDate}</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><div className="text-xs text-primary font-semibold mb-1">이게돼 챔피언</div>{(s.byItge as A[]).map(a => <Row key={a.id} a={a} unit="개" />)}</div>
              <div><div className="text-xs text-primary font-semibold mb-1">꾸준함 챔피언</div>{(s.byTotal as A[]).map(a => <Row key={a.id} a={a} unit="회" />)}</div>
            </div>
          </section>
        ))}
    </div>
  );
}
