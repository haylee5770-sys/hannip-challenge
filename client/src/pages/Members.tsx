import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function Members() {
  const members = trpc.members.list.useQuery();

  return (
    <div>
      <section className="grid grid-cols-12 gap-6 items-end pb-10 border-b hairline">
        <div className="col-span-12 md:col-span-9">
          <div className="editorial-eyebrow text-muted-foreground mb-3">DIRECTORY</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl">
            우리의 <span className="italic font-serif font-light">멤버</span>
          </h1>
        </div>
        <div className="col-span-12 md:col-span-3 md:text-right">
          <div className="editorial-eyebrow text-muted-foreground mb-1">TOTAL</div>
          <div className="number-display text-4xl">{members.data?.length ?? "—"}</div>
        </div>
      </section>

      {members.isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <section className="py-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {members.data?.map(m => (
            <div key={m.id} className="text-left">
              <div className="aspect-[3/4] bg-secondary border hairline mb-3 overflow-hidden">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center editorial-h1 text-6xl text-muted-foreground italic font-serif">
                    {(m.name ?? "?").charAt(0)}
                  </div>
                )}
              </div>
              <div className="editorial-eyebrow text-muted-foreground mb-1">
                {m.role === "admin" ? "ADMIN" : "MEMBER"}
              </div>
              <h3 className="editorial-h2 text-xl">{m.name ?? "이름 없음"}</h3>
              {m.bio && (
                <p className="font-serif italic text-sm text-muted-foreground mt-1 line-clamp-3">{m.bio}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
