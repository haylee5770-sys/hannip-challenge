// 구매하기 — 2026-11-20 방장 요청
// 15개 구매: 10% 할인 / 45개 구매: 10% 할인 + 3,000원 추가 할인
// 네이버 구매 후 후기를 남기면 매달 1명을 뽑아 스무디 15개 증정

const PRODUCTS = [
  {
    title: "스무디 15개",
    badge: "10% 할인",
    url: "https://smartstore.naver.com/superhane/products/10116621156",
  },
  {
    title: "스무디 45개",
    badge: "10% 할인 + 3,000원 추가 할인",
    url: "https://smartstore.naver.com/superhane/products/10378603578",
  },
];

export default function Shop() {
  return (
    <div>
      <section className="pb-10 border-b hairline">
        <div className="editorial-eyebrow text-muted-foreground mb-3">SHOP · 구매하기</div>
        <h1 className="editorial-h1 text-5xl md:text-7xl">
          스무디 <span className="italic font-serif font-light">구매하기</span>
        </h1>
        <p className="mt-4 text-muted-foreground">버튼을 누르면 네이버 스마트스토어 구매 페이지로 바로 이동해요.</p>
      </section>

      <section className="py-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        {PRODUCTS.map(p => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-border bg-card p-6 hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="editorial-h2 text-3xl">{p.title}</h2>
              <span className="bg-primary text-primary-foreground text-sm font-semibold px-3 py-1">{p.badge}</span>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 bg-[#03c75a] text-white font-semibold px-5 py-3">
              네이버에서 구매하기 →
            </div>
          </a>
        ))}
      </section>

      <section className="py-10 border-t hairline">
        <div className="border-2 border-primary p-6 md:p-8">
          <div className="editorial-eyebrow text-primary mb-2">EVENT · 매달 1명</div>
          <h2 className="editorial-h2 text-3xl md:text-4xl mb-4">후기 남기고 스무디 15개 받아 가세요 🎁</h2>
          <ul className="space-y-2 text-base leading-relaxed">
            <li>✔ 네이버에서 스무디를 구매하고 <b>후기를 남겨 주세요.</b></li>
            <li>✔ 매달 후기를 남긴 분들 중 <b>1명을 뽑아 스무디 15개</b>를 보내 드려요.</li>
            <li>✔ 15개든 45개든, <b>어떤 상품이든 상관없어요.</b></li>
            <li>✔ 우리 방 멤버들만 구매하는 상품이라 <b>당첨 확률이 아주 높아요!</b></li>
          </ul>
          <p className="mt-4 text-muted-foreground text-sm">후기는 한 달 동안 남긴 것을 모두 모아 그중 1명을 뽑아요.</p>
        </div>
      </section>
    </div>
  );
}
