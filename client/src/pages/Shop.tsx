// 구매하기 — 2026-11-21 다시 디자인
// 15개 구매: 10% 할인 / 45개 구매: 10% 할인 + 3,000원 추가 할인
// 후기 이벤트: 2달에 한 번(홀수달) 1명 네이버페이 2만 원권 (2026-11-22 변경) · 포토 후기 적립: 45개 2,000원 / 15개 1,000원
import PageTitle from "@/components/PageTitle";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const PRODUCTS = [
  { qty: 15, list: 100000, salePrice: 90000, sale: "10% 할인", extra: null as string | null, point: "1,000원", url: "https://smartstore.naver.com/superhane/products/10116621156" },
  { qty: 45, list: 290000, salePrice: 258000, sale: "10% 할인", extra: "+ 3,000원 추가 할인", point: "2,000원", url: "https://smartstore.naver.com/superhane/products/10378603578" },
];
// 2026-11-23 (해이): 공구 할인 기간. 이 시간 안에만 공구가가 보이고, 끝나면 안내 문구는 저절로 사라진다. 다음 공구 때 여기만 바꾸면 됨
const SALES = [{ start: "2026-11-23T09:50:00+09:00", end: "2026-11-23T23:59:59+09:00", label: "11월 23일(월) 오전 9시 50분 ~ 밤 11시 59분" }];
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function Shop() {
  const { user } = useAuth();
  // 2026-11-22 구매 안내창(해이 확정): 누르면 '닉네임 크루'를 복사하고, 배송 메시지에 붙여 넣으라고 안내한 뒤 네이버로
  const [pick, setPick] = useState<(typeof PRODUCTS)[number] | null>(null);
  const tag = `${user?.name ?? ""} 크루`;
  const now = Date.now();
  const live = SALES.find(x => now >= Date.parse(x.start) && now <= Date.parse(x.end));
  const soon = !live ? SALES.find(x => now < Date.parse(x.start) && Date.parse(x.start) - now < 24 * 3600_000) : undefined;
  const open = async (p: (typeof PRODUCTS)[number]) => {
    // 2026-11-22 (해이): 선물은 45개만 → 15개는 안내창 없이 바로 네이버로
    if (p.qty !== 45) { window.open(p.url, "_blank", "noopener"); return; }
    try { await navigator.clipboard.writeText(tag); } catch { /* 복사가 막혀도 안내창은 띄운다 */ }
    setPick(p);
  };
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

      {/* 2026-11-23: 할인 기간 안내 — 기간이 지나면 저절로 사라짐 */}
      {live ? (
        <section className="rounded-2xl bg-[#03c75a]/15 border border-[#03c75a] p-4 text-center">
          <div className="text-base font-black">🔥 지금 공구 할인 중!</div>
          <div className="text-sm mt-1">{live.label}</div>
        </section>
      ) : soon ? (
        <section className="rounded-2xl border border-primary/60 bg-primary/10 p-4 text-center">
          <div className="text-base font-black">⏰ 곧 공구 할인이 열려요</div>
          <div className="text-sm mt-1">{soon.label}</div>
        </section>
      ) : (
        <p className="text-center text-xs text-muted-foreground">지금은 <b className="text-foreground">정가</b>예요. 공구 할인은 단톡방 공지 후 열려요.</p>
      )}

      {/* 상품 — 같은 모양 두 칸 */}
      <section className="grid grid-cols-2 gap-3">
        {PRODUCTS.map(p => (
          <button type="button" key={p.url} onClick={() => open(p)}
            className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center text-center hover:border-primary transition-colors">
            <div className="text-sm text-muted-foreground">스무디</div>
            <div className="text-4xl font-black tabular-nums leading-none mt-1">{p.qty}<span className="text-lg font-bold ml-0.5">개</span></div>
            {live ? (
              <>
                <div className="mt-3 text-xs text-muted-foreground line-through tabular-nums">정가 {won(p.list)}</div>
                <div className="text-xl font-black text-primary tabular-nums">{won(p.salePrice)}</div>
                <div className="mt-1 rounded-full bg-primary/15 text-primary text-xs font-bold px-3 py-1">{p.sale}{p.extra ? " · 3,000원 추가" : ""}</div>
              </>
            ) : (
              <>
                <div className="mt-3 text-xs text-muted-foreground">정가</div>
                <div className="text-xl font-black tabular-nums">{won(p.list)}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">공구 때 {won(p.salePrice)}</div>
              </>
            )}
            <div className="mt-3 w-full rounded-xl bg-[#03c75a] text-white text-sm font-bold py-2.5 whitespace-nowrap">네이버에서 구매하기</div>
            <div className="mt-2 text-[11px] text-muted-foreground leading-snug">리뷰 시 포토 후기<br /><b className="text-primary">기본 {p.point} 적립</b></div>
          </button>
        ))}
      </section>
      <p className="text-center text-[11px] text-muted-foreground">2달 동안 남긴 후기를 모두 모아 홀수달에 1명을 뽑아요.</p>

      {pick && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-6" onClick={() => setPick(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-card border border-primary/50 p-6 text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-4xl">📝</div>
            <h3 className="text-xl font-bold break-keep">배송 메시지에 닉네임을<br />꼭 적어 주세요</h3>
            <p className="text-sm text-muted-foreground break-keep leading-relaxed">
              그래야 크루 선물(스무디 2개)이 같이 나가요.
            </p>
            <div className="rounded-2xl bg-primary/10 border border-primary/40 p-3 text-sm break-keep">
              닉네임 <b className="text-primary">'{tag}'</b>가 복사됐어요.<br />배송 메시지 칸에 붙여 넣기만 하세요.
            </div>
            <button type="button" className="glass-btn w-full py-3 text-base"
              onClick={() => { window.open(pick.url, "_blank", "noopener"); setPick(null); }}>
              <span className="relative z-[1]">확인했어요 → 구매하러 가기</span>
            </button>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setPick(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
