// 할인 오픈 팝업 (2026-11-25 해이): 매달 1일·15일(한국 시간 0시 ~ 밤 11시 59분)에 앱을 열면
// "오늘 하루 할인 링크가 열렸어요" 팝업이 그날 한 번만 뜬다. [구매하러 가기]를 누르면 구매하기 화면으로.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { saleWindow } from "@/lib/saleDays";

const KEY = "hannip_sale_popup_seen";

export default function SalePopup() {
  const [location, navigate] = useLocation();
  const [, setTick] = useState(0);
  const [closedKey, setClosedKey] = useState<string | null>(() => { try { return localStorage.getItem(KEY); } catch { return null; } });
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60_000); return () => clearInterval(t); }, []);

  const { live } = saleWindow();
  if (!live || closedKey === live.key || location.startsWith("/shop")) return null;

  const close = (toShop?: boolean) => {
    try { localStorage.setItem(KEY, live.key); } catch {}
    setClosedKey(live.key);
    if (toShop) navigate("/shop");
  };

  return (
    <div className="fixed inset-0 z-[114] bg-black/70 flex items-center justify-center p-5" onClick={() => close()}>
      <div className="w-full max-w-sm rounded-3xl bg-card border-2 border-primary p-6 text-center space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-5xl">🔥</div>
        <h3 className="text-2xl font-black leading-snug break-keep">오늘 하루<br /><span className="text-primary">할인 링크가 열렸어요!</span></h3>
        <div className="rounded-2xl bg-primary/10 border border-primary/40 p-3 text-sm font-bold break-keep">{live.label}</div>
        <ul className="text-sm text-left space-y-1 break-keep mx-auto w-fit">
          <li>✔ 15개 <b>10% 할인</b></li>
          <li>✔ 45개 <b>10% + 3,000원 할인</b> + 크루 선물 2개</li>
        </ul>
        <p className="text-xs text-muted-foreground break-keep">할인 링크는 매달 1일·15일 딱 하루만 열려요.</p>
        <button type="button" className="glass-btn w-full py-3 text-base font-black" onClick={() => close(true)}>
          <span className="relative z-[1]">구매하러 가기 →</span>
        </button>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => close()}>닫기</button>
      </div>
    </div>
  );
}
