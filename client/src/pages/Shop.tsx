// 구매하기 — 2026-11-21 다시 디자인
// 15개 구매: 10% 할인 / 45개 구매: 10% 할인 + 3,000원 추가 할인
// 후기 이벤트: 2달에 한 번(홀수달) 1명 네이버페이 2만 원권 (2026-11-22 변경) · 포토 후기 적립: 45개 2,000원 / 15개 1,000원
import PageTitle from "@/components/PageTitle";

const PRODUCTS = [
  { qty: 15, sale: "10% 할인", extra: null as string | null, point: "1,000원", url: "https://smartstore.naver.com/superhane/products/10116621156" },
  { qty: 45, sale: "10% 할인", extra: "+ 3,000원 추가 할인", point: "2,000원", url: "https://smartstore.naver.com/superhane/products/10378603578" },
];

export default function Shop() {
  return (
    <div className="space-y-5">
      <PageTitle eyebrow="SHOP" title="스무디 구매하기" sub="버튼을 누르면 네이버 스마트스토어로 바로 가요." />

      {/* 이벤트 — 가장 크게 */}
      <section className="rounded-2xl border-2 border-primary bg-primary/10 p-5 text-center">
        <div className="inline-block rounded-full bg-primary text-primary-foreground text-sm font-bold px-4 py-1 mb-3">EVENT · 2달에 1명</div>
        <h2 className="text-2xl md:text-3xl font-bold leading-snug break-keep">
          후기 남기면<br />네이버페이 <span className="text-primary">2만 원권</span> 🎁
        </h2>
        <ul className="mt-4 space-y-1.5 text-sm text-left max-w-xs mx-auto break-keep">
          <li>✔ <b>정성과 진심을 담아 후기를 적어 주신 분께</b></li>
          <li>✔ <b>슈퍼한입 챌린지를 널리 알리고 싶으신 분께</b></li>
          <li>✔ <b>2달에 한 번</b>(1·3·5·7·9·11월) <b>1명</b>을 뽑아 네이버페이 2만 원권을 드려요</li>
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
            <div className="mt-2 text-[11px] text-muted-foreground leading-snug">리뷰 시 포토 후기<br /><b className="text-primary">기본 {p.point} 적립</b></div>
          </a>
        ))}
      </section>
      <p className="text-center text-[11px] text-muted-foreground">2달 동안 남긴 후기를 모두 모아 홀수달에 1명을 뽑아요.</p>
    </div>
  );
}
