// 구매하기 — 2026-11-21 다시 디자인
// 15개 구매: 10% 할인 / 45개 구매: 10% 할인 + 3,000원 추가 할인
// 네이버 구매 후 후기를 남기면 매달 1명을 뽑아 스무디 15개 증정
import PageTitle from "@/components/PageTitle";

const PRODUCTS = [
  { qty: 15, sale: "10% 할인", extra: null as string | null, url: "https://smartstore.naver.com/superhane/products/10116621156" },
  { qty: 45, sale: "10% 할인", extra: "+ 3,000원 추가 할인", url: "https://smartstore.naver.com/superhane/products/10378603578" },
];

export default function Shop() {
  return (
    <div className="space-y-5">
      <PageTitle eyebrow="SHOP" title="스무디 구매하기" sub="버튼을 누르면 네이버 스마트스토어로 바로 가요." />

      {/* 이벤트 — 가장 크게 */}
      <section className="rounded-2xl border-2 border-primary bg-primary/10 p-5 text-center">
        <div className="inline-block rounded-full bg-primary text-primary-foreground text-sm font-bold px-4 py-1 mb-3">EVENT · 매달 1명</div>
        <h2 className="text-2xl md:text-3xl font-bold leading-snug break-keep">
          후기 남기면<br />스무디 <span className="text-primary">15개</span> 선물 🎁
        </h2>
        <ul className="mt-4 space-y-1.5 text-sm text-left max-w-xs mx-auto break-keep">
          <li>✔ 네이버에서 구매하고 <b>후기만 남기면 응모 끝</b></li>
          <li>✔ 매달 <b>1명</b> 뽑아 스무디 15개를 보내 드려요</li>
          <li>✔ 15개·45개 <b>어떤 상품이든</b> 괜찮아요</li>
          <li>✔ 우리 방 멤버만 사는 상품이라 <b>당첨 확률 높아요</b></li>
        </ul>
      </section>

      {/* 상품 — 같은 모양 두 칸 */}
      <section className="grid grid-cols-2 gap-3">
        {PRODUCTS.map(p => (
          <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center text-center hover:border-primary transition-colors">
            <div className="text-sm text-muted-foreground">스무디</div>
            <div className="text-4xl font-black tabular-nums leading-none mt-1">{p.qty}<span className="text-lg font-bold ml-0.5">개</span></div>
            <div className="mt-3 rounded-full bg-primary/15 text-primary text-sm font-bold px-3 py-1">{p.sale}</div>
            <div className="mt-1 h-5 text-xs font-semibold text-primary">{p.extra ?? ""}</div>
            <div className="mt-3 w-full rounded-xl bg-[#03c75a] text-white text-sm font-bold py-2.5 whitespace-nowrap">네이버에서 구매하기</div>
          </a>
        ))}
      </section>
      <p className="text-center text-[11px] text-muted-foreground">후기는 한 달 동안 남긴 것을 모두 모아 그중 1명을 뽑아요.</p>
    </div>
  );
}
