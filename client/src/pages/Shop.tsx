// 구매하기 — 2026-11-21 다시 디자인
// 15개 구매: 10% 할인 / 45개 구매: 10% 할인 + 3,000원 추가 할인
// 후기 이벤트: 2달에 한 번(홀수달) 1명 네이버페이 2만 원권 (2026-11-22 변경) · 포토 후기 적립: 45개 2,000원 / 15개 1,000원
import PageTitle from "@/components/PageTitle";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const PRODUCTS = [
  { qty: 15, list: 100000, salePrice: 90000, sale: "10% 할인", extra: null as string | null, point: "1,000원", url: "https://smartstore.naver.com/superhane/products/10116621156" },
  { qty: 45, list: 290000, salePrice: 258000, sale: "10% 할인", extra: "+ 3,000원 추가 할인", point: "2,000원", url: "https://smartstore.naver.com/superhane/products/10378603578" },
];
// 2026-11-25 (해이 확정): 할인 링크는 상시로 열지 않는다 → 매달 1일·15일, 한국 시간 0시 ~ 밤 11시 59분 딱 하루만 저절로 열리고 닫힌다
const SALE_DAYS = [1, 15];
const KST = 9 * 3600_000;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** 한국 시간으로 y년 m월(0부터) d일 0시의 실제 시각 */
const kstMidnight = (y: number, m: number, d: number) => Date.UTC(y, m, d) - KST;
function saleWindow(now: number) {
  const k = new Date(now + KST); // 한국 날짜를 UTC 칸으로 읽는다
  const y = k.getUTCFullYear(), m = k.getUTCMonth(), d = k.getUTCDate();
  const mk = (yy: number, mm: number, dd: number) => {
    const start = kstMidnight(yy, mm, dd), end = start + 24 * 3600_000 - 1000;
    const t = new Date(start + KST);
    return { start, end, label: `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일(${DOW[t.getUTCDay()]}) 0시 ~ 밤 11시 59분` };
  };
  const live = SALE_DAYS.includes(d) ? mk(y, m, d) : undefined;
  const nextDay = SALE_DAYS.find(x => x > d);
  const next = nextDay ? mk(y, m, nextDay) : mk(y, m + 1, SALE_DAYS[0]);
  return { live, next };
}
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function Shop() {
  const { user } = useAuth();
  // 2026-11-22 구매 안내창(해이 확정): 누르면 '닉네임 크루'를 복사하고, 배송 메시지에 붙여 넣으라고 안내한 뒤 네이버로
  const [pick, setPick] = useState<(typeof PRODUCTS)[number] | null>(null);
  const tag = `${user?.name ?? ""} 크루`;
  const [, setTick] = useState(0); // 화면을 켜 둔 채 0시가 지나도 1분 안에 저절로 열리고 닫히게
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60_000); return () => clearInterval(t); }, []);
  const now = Date.now();
  const { live, next } = saleWindow(now);
  const soon = !live && next.start - now < 24 * 3600_000 ? next : undefined;
  const open = async (p: (typeof PRODUCTS)[number]) => {
    // 2026-11-22 (해이): 선물은 45개만 → 15개는 안내창 없이 바로 네이버로
    if (p.qty !== 45) { window.open(p.url, "_blank", "noopener"); return; }
    try { await navigator.clipboard.writeText(tag); } catch { /* 복사가 막혀도 안내창은 띄운다 */ }
    setPick(p);
  };
  return (
    <div className="space-y-3">
      {/* 2026-11-23 (해이): 제목 빼고 이벤트를 작게 → 아래 네이버 구매 버튼이 첫 화면에 보이게 */}
      <section className="rounded-2xl border border-primary bg-primary/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-black leading-snug break-keep">🎁 후기왕 <span className="text-primary">20,000원 적립</span></h2>
          <span className="shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5">2달에 1명</span>
        </div>
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-muted-foreground break-keep">
          <li>✔ <b className="text-foreground">정성과 진심을 담아 후기를 적어 주신 분께</b></li>
          <li>✔ <b className="text-foreground">슈퍼한입 챌린지를 널리 알리고 싶으신 분께</b></li>
          <li>✔ <b className="text-foreground">2달에 한 번</b>(1·3·5·7·9·11월) <b className="text-foreground">1명</b>을 뽑아 <b className="text-foreground">20,000원을 적립</b>해 드려요</li>
          <li>✔ 15개·45개 <b className="text-foreground">어떤 상품이든</b> 괜찮아요</li>
          <li>✔ 우리 방 멤버만 사는 상품이라 <b className="text-foreground">당첨 확률 높아요</b></li>
        </ul>
      </section>

      {/* 2026-11-23: 할인 기간 안내 — 기간이 지나면 저절로 사라짐 */}
      {live ? (
        <section className="rounded-2xl bg-[#03c75a]/15 border border-[#03c75a] px-4 py-2.5 text-center">
          <div className="text-sm font-black">🔥 오늘 하루 할인 링크가 열렸어요!</div>
          <div className="text-xs mt-0.5">{live.label}</div>
        </section>
      ) : soon ? (
        <section className="rounded-2xl border border-primary/60 bg-primary/10 px-4 py-2.5 text-center">
          <div className="text-sm font-black">⏰ 오늘 하루 할인 링크가 열려요</div>
          <div className="text-xs mt-0.5">{soon.label}</div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card px-4 py-2.5 text-center">
          <div className="text-xs text-muted-foreground">지금은 <b className="text-foreground">정가</b>예요</div>
          <div className="text-sm font-black mt-0.5">📅 할인 링크는 <span className="text-primary">매달 1일·15일</span> 딱 하루만 열려요</div>
          <div className="text-xs mt-0.5">다음 오픈: <b>{next.label}</b></div>
        </section>
      )}
      {live && <p className="text-center text-[11px] text-muted-foreground">할인 링크는 <b className="text-foreground">매달 1일·15일</b> 0시 ~ 밤 11시 59분에만 열려요.</p>}

      {/* 상품 — 같은 모양 두 칸 */}
      <section className="grid grid-cols-2 gap-3">
        {PRODUCTS.map(p => (
          <button type="button" key={p.url} onClick={() => open(p)}
            className="h-full rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center hover:border-primary transition-colors">
            <div className="text-sm text-muted-foreground">스무디</div>
            <div className="text-4xl font-black tabular-nums leading-none mt-1">{p.qty}<span className="text-lg font-bold ml-0.5">개</span></div>
            {live ? (
              <>
                <div className="mt-3 text-xs text-muted-foreground line-through tabular-nums">정가 {won(p.list)}</div>
                <div className="text-xl font-black text-primary tabular-nums">{won(p.salePrice)}</div>
                <div className="mt-1 rounded-full bg-primary/15 text-primary text-xs font-bold px-3 py-1">{p.sale}{p.extra ? <><br />3,000원 추가</> : null}</div>
              </>
            ) : (
              <>
                <div className="mt-3 text-xs text-muted-foreground">정가</div>
                <div className="text-xl font-black tabular-nums">{won(p.list)}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">공구 때 {won(p.salePrice)}</div>
              </>
            )}
            <div className="flex-1 min-h-3" />{/* 2026-11-23: 두 칸의 구매 버튼 높이를 맞춤 (짧은 쪽에 여백) */}
            <div className="w-full rounded-xl bg-[#03c75a] text-white text-sm font-bold py-2.5 whitespace-nowrap">네이버에서 구매하기</div>
            <div className="mt-2 text-[11px] text-muted-foreground leading-snug">리뷰 시 포토 후기<br /><b className="text-primary">기본 {p.point} 적립</b></div>
          </button>
        ))}
      </section>
      {/* 2026-11-23 (해이): 공구 때 15개 vs 45개 혜택 비교 — 45개는 10% + 3,000원 + 크루 선물 2개 */}
      <section className="rounded-3xl border-2 border-primary bg-primary/10 p-5 space-y-4">
        <div className="text-center">
          <div className="text-xs font-bold text-primary tracking-widest">공구 혜택 비교</div>
          <h3 className="text-xl font-black mt-1 break-keep">45개가 훨씬 이득이에요 🎁</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-card border border-border p-3 space-y-1.5">
            <div className="font-black text-base">15개</div>
            <div>✔ 10% 할인<br /><b>−10,000원</b></div>
            <div className="text-muted-foreground">✕ 추가 할인 없음</div>
            <div className="text-muted-foreground">✕ 크루 선물 없음</div>
            <div className="pt-2 border-t border-border">
              <div className="text-[11px] text-muted-foreground">총 혜택</div>
              <div className="text-lg font-black tabular-nums">10,000원</div>
                          </div>
          </div>
          <div className="rounded-2xl bg-card border-2 border-primary p-3 space-y-1.5">
            <div className="font-black text-base text-primary">45개 <span className="text-[11px] rounded-full bg-primary/20 px-2 py-0.5 align-middle">추천</span></div>
            <div>✔ 10% 할인<br /><b>−29,000원</b></div>
            <div>✔ 추가 할인<br /><b>−3,000원</b></div>
            <div>✔ 크루 선물<br /><b>스무디 2개</b><br /><span className="text-[11px] text-muted-foreground">(약 12,900원 상당)</span></div>
            <div className="pt-2 border-t border-primary/40">
              <div className="text-[11px] text-muted-foreground">총 혜택</div>
              <div className="text-lg font-black text-primary tabular-nums">약 44,900원</div>
                          </div>
          </div>
        </div>
        <div className="text-center leading-relaxed break-keep">
          <p className="text-[11px] text-muted-foreground">크루 선물 2개는 <b className="text-foreground">배송 메시지에 닉네임</b>을 적어 주셔야 함께 나가요.</p>
          <p className="text-xs font-bold text-red-500 mt-1">배송 메시지에 적어 주시지 않으면 자동으로 발송되지 않아요.<br />이건 AI로도 안 돼요.</p>
        </div>
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
