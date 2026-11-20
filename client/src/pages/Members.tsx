// 멤버 (2026-11-20) — 활동명 동그라미 바둑판 + 활동명 검색(겹치면 사용 불가, 수지↔배수지도 막음) + 내 활동명 바꾸기
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

const SUGGEST = ["아이유", "수지", "제니", "카리나", "윈터", "장원영", "안유진", "김태리", "한소희", "박보영", "김고은", "전지현", "손예진", "공효진", "이영애", "송혜교", "김연아", "로제", "지수", "태연"];

export default function Members() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const members = trpc.members.list.useQuery();
  const [q, setQ] = useState("");
  const check = trpc.members.checkName.useQuery({ name: q.trim() }, { enabled: q.trim().length >= 2 });
  const setNick = trpc.members.setNickname.useMutation({
    onSuccess: () => { toast.success("활동명을 바꿨어요"); utils.members.list.invalidate(); utils.auth.me.invalidate(); setQ(""); },
    onError: (e) => toast.error(e.message),
  });
  const taken = new Set((members.data ?? []).map(m => (m.name ?? "").replace(/\s+/g, "")));
  const takenList = Array.from(taken).filter(Boolean);
  const free = SUGGEST.filter(s => !takenList.some(t => t.includes(s) || s.includes(t))).slice(0, 8);

  return (
    <div className="space-y-5">
      <section className="text-center">
        <div className="editorial-eyebrow text-primary mb-1">CREW</div>
        <h1 className="text-3xl md:text-4xl font-semibold">우리의 멤버 <span className="text-primary">{members.data?.length ?? ""}</span></h1>
      </section>

      <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="text-sm font-semibold">활동명 검색 · 바꾸기</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} maxLength={20} placeholder="쓰고 싶은 활동명 (예: 수지)" className="pl-9 rounded-xl bg-transparent h-11" />
          </div>
          <Button className="rounded-xl h-11" disabled={!check.data?.ok || setNick.isPending} onClick={() => setNick.mutate({ name: q.trim() })}>
            {setNick.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "이 이름 쓰기"}
          </Button>
        </div>
        {q.trim().length >= 2 && check.data && (
          check.data.ok
            ? <p className="text-sm text-primary">✓ 쓸 수 있는 이름이에요.</p>
            : <p className="text-sm text-rose-300">✕ {check.data.reason} {check.data.similar.length ? `(이미 있음: ${check.data.similar.join(", ")})` : ""}</p>
        )}
        {free.length > 0 && (
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">추천 이름 (누르면 검색)</div>
            <div className="flex flex-wrap gap-1.5">{free.map(s => <button key={s} type="button" onClick={() => setQ(s)} className="px-3 py-1 rounded-full border border-border text-xs hover:border-primary">{s}</button>)}</div>
          </div>
        )}
        {user?.name && <p className="text-[11px] text-muted-foreground">지금 내 활동명: <b className="text-foreground">{user.name}</b></p>}
      </section>

      {members.isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <section className="grid grid-cols-5 gap-2">
          {members.data?.map(m => (
            <div key={m.id} className="aspect-square rounded-full border border-primary/50 bg-card flex items-center justify-center p-1 text-center">
              <span className="text-[11px] font-semibold leading-tight line-clamp-2">{m.name ?? "?"}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
