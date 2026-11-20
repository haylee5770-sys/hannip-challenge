// 모든 메뉴 제목을 한 가지 모양으로 (2026-11-21): 작은 영문 머리글 + 가운데 굵은 제목 + 설명 한 줄
export default function PageTitle({ eyebrow, title, sub, accent }: { eyebrow: string; title: string; sub?: string; accent?: string | number | null }) {
  return (
    <section className="text-center pb-2">
      <div className="editorial-eyebrow text-primary mb-1">{eyebrow}</div>
      <h1 className="text-3xl md:text-4xl font-semibold break-keep">
        {title}{accent != null && accent !== "" ? <> <span className="text-primary">{accent}</span></> : null}
      </h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground break-keep">{sub}</p>}
    </section>
  );
}
