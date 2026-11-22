import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { isKakaoInApp, openInExternalBrowser } from "@/lib/proofCard";
import type { ConfirmReq } from "@/lib/askConfirm";

const NAV_ITEMS = [
  // 2026-11-20 방장 지정 순서
  { label: "TODAY", path: "/today", korean: "오늘" },
  { label: "YEAR", path: "/year", korean: "1년" },
  { label: "ITGE", path: "/itge", korean: "이게돼" },
  { label: "MY CHANGE", path: "/dashboard", korean: "나의 변화" },
  { label: "BEFORE·AFTER", path: "/before-after", korean: "비포 애프터" },
  { label: "MEMBERS", path: "/members", korean: "멤버" },
  { label: "AWARDS", path: "/awards", korean: "시상식" },
  { label: "HISTORY", path: "/history", korean: "역대 챌린지" },
  { label: "SHOP", path: "/shop", korean: "구매하기" },
  { label: "STYLE", path: "/decor", korean: "꾸미기" },
  { label: "AWARD", path: "/award-apply", korean: "상 받기 신청" },
  { label: "EVENT", path: "/events", korean: "이벤트 참여" },
  { label: "VOICE", path: "/feedback", korean: "의견 보내기" },
];

const ADMIN_ITEMS = [
  { label: "ADMIN", path: "/admin", korean: "관리" },
];

/** 카톡 안 브라우저일 때: 인증 사진을 화면에 띄워 길게 눌러 저장 + 크롬으로 열기 안내 */
function ProofPreview() {
  const [imgs, setImgs] = useState<string[] | null>(null);
  const setImg = (v: null) => setImgs(v);
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail ?? {}; setImgs(d.dataUrls ?? (d.dataUrl ? [d.dataUrl] : null)); };
    window.addEventListener("hannip-proof-preview", h);
    return () => window.removeEventListener("hannip-proof-preview", h);
  }, []);
  if (!imgs?.length) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-5 gap-3 overflow-y-auto" onClick={() => setImg(null)}>
      <div className="w-full max-w-sm space-y-3 max-h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {imgs.map((src, i) => <img key={i} src={src} alt={`인증 사진 ${i + 1}`} className="w-full rounded-2xl" />)}
      </div>
      {imgs.length > 1 && <p className="text-xs text-white/80">사진 {imgs.length}장이에요. 한 장씩 길게 눌러 저장해 주세요.</p>}
      <p className="text-sm text-white text-center leading-relaxed">사진을 <b>길게 눌러 저장</b>한 뒤 카톡방에 올려 주세요.<br />문구는 복사돼 있어요.</p>
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <Button onClick={openInExternalBrowser} className="rounded-full">크롬으로 열면 한 번에 보내져요</Button>
        <Button variant="outline" onClick={() => setImg(null)} className="rounded-full">닫기</Button>
      </div>
    </div>
  );
}

/** 앱 안 확인 팝업 (삭제할까요?) — askConfirm()으로 띄움 */
function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => {
    const h = (e: Event) => setReq((e as CustomEvent<ConfirmReq>).detail);
    window.addEventListener("hannip-confirm", h);
    return () => window.removeEventListener("hannip-confirm", h);
  }, []);
  if (!req) return null;
  const done = (v: boolean) => { req.resolve(v); setReq(null); };
  return (
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-6" onClick={() => done(false)}>
      <div className="w-full max-w-xs rounded-2xl bg-card border border-border p-5 text-center" onClick={e => e.stopPropagation()}>
        <p className="text-base font-semibold leading-relaxed whitespace-pre-line break-keep">{req.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" className="rounded-xl h-11" onClick={() => done(false)}>취소</Button>
          <Button className="rounded-xl h-11 bg-rose-500 hover:bg-rose-600 text-white" onClick={() => done(true)}>{req.ok ?? "삭제"}</Button>
        </div>
      </div>
    </div>
  );
}

/** 시즌별 몸무게 (2026-11-22): 시즌 시작 때 한 번 + 끝나기 전 마지막 3일에 한 번. 기록하면 사라짐 */
function WeighInBanner() {
  const q = trpc.rounds.weighStatus.useQuery(undefined, { staleTime: 10 * 60_000, retry: false });
  if (!q.data?.need) return null;
  return (
    <Link href="/today#weight">
      <div className="bg-rose-600 text-white text-center text-sm font-bold py-2 px-3 cursor-pointer">
        ⚖️ {q.data.need === "start" ? "새 시즌 시작! 몸무게를 기록해 주세요." : "시즌 마무리! 마지막 몸무게를 기록해 주세요."} 아침 공복에 재고 사진과 함께 올려 주세요.
      </div>
    </Link>
  );
}

function KakaoInAppNotice() {
  const [hide, setHide] = useState(false);
  if (!isKakaoInApp() || hide) return null;
  return (
    <div className="container pt-2">
      <div className="rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 flex items-center gap-2 text-xs">
        <span className="flex-1">카톡 안에서는 인증 사진이 바로 안 보내져요. 크롬에서 열고 <b>홈 화면에 추가</b>해 두세요.</span>
        <button type="button" onClick={openInExternalBrowser} className="shrink-0 rounded-full bg-primary text-primary-foreground font-semibold px-3 py-1.5">{/iPhone|iPad/i.test(navigator.userAgent) ? "사파리로 열기" : "크롬으로 열기"}</button>
        <button type="button" onClick={() => setHide(true)} className="text-muted-foreground">✕</button>
      </div>
    </div>
  );
}

function YearProgressBar() {
  const q = trpc.happy.yearProgress.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const days = q.data?.days ?? 0;
  const total = q.data?.total ?? 365;
  // 2026-11-22: 동그라미는 오늘 날짜 위치 (1월 1일 → 12월 31일)
  const now = new Date(Date.now() + 9 * 3600_000);
  const y = now.getUTCFullYear();
  const dayOfYear = Math.floor((Date.UTC(y, now.getUTCMonth(), now.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400_000) + 1;
  const yearDays = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const pct = Math.min(100, (dayOfYear / yearDays) * 100);
  return (
    <div className="container pb-4">
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-secondary" />
        <div className="absolute left-0 h-1.5 rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
        <div
          className="absolute h-4 w-4 rounded-full bg-primary shadow-[0_0_10px_rgba(182,242,74,0.7)] -translate-x-1/2 transition-all duration-700"
          style={{ left: `${Math.max(1, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
        <span>나의 {y}년</span>
        <span>올해 <b className="text-primary">{days}</b>일 기록했어요 · {yearDays}일</span>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 2026-11-22: 앱을 다시 열면(10분 넘게 안 쓰다가) 언제나 '오늘'부터
  useEffect(() => {
    const KEY = "hannipLastSeen";
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last > 10 * 60_000 && location !== "/today" && location !== "/") navigate("/today", { replace: true });
    const mark = () => localStorage.setItem(KEY, String(Date.now()));
    mark();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        const l = Number(localStorage.getItem(KEY) || 0);
        if (Date.now() - l > 10 * 60_000) navigate("/today", { replace: true });
      }
      mark();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(mark, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = user?.role === "admin";
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-background paper-grain">
      {/* Top masthead */}
      <WeighInBanner />
      <header className="border-b hairline">
        <div className="container">
          <div className="flex items-center justify-between py-5 md:py-7">
            <div className="flex items-center gap-8">
              <Link href="/today">
                <div className="flex flex-col items-start">
                  <span className="text-xs md:text-sm text-primary font-medium">인생을 바꾸는 가장 쉬운 방법</span>
                  <span className="editorial-h2 text-2xl md:text-3xl tracking-tight">
                    super hannip <span className="italic font-serif font-light">Challenge</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Since 2022.5.9</span>
                </div>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              {items.map(item => {
                const active = location === item.path || (item.path !== "/today" && location.startsWith(item.path));
                return (
                  <Link key={item.path} href={item.path}>
                    <span
                      className={cn(
                        "editorial-eyebrow transition-colors duration-200",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                      style={{ transitionTimingFunction: "var(--ease-out)" }}
                    >
                      {item.korean}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 border hairline hover:bg-secondary/50 transition-colors"
                    style={{ transitionDuration: "180ms", transitionTimingFunction: "var(--ease-out)" }}
                  >
                    <span className="editorial-eyebrow text-muted-foreground">
                      {user?.name || "GUEST"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-none">
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <span className="font-serif text-base">프로필</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 2026-11-22: 메뉴 버튼 = 내 프로필 사진 동그라미 (크루에게 "오른쪽 위 내 사진 누르세요") */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="md:hidden relative h-11 w-11 rounded-full p-[2px] bg-primary shadow-[0_0_12px_rgba(182,242,74,0.45)] active:scale-95 transition"
                aria-label="메뉴"
              >
                {mobileOpen ? (
                  <span className="h-full w-full rounded-full bg-background flex items-center justify-center"><X className="h-5 w-5" /></span>
                ) : user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="메뉴" className="h-full w-full rounded-full object-cover bg-background" />
                ) : (
                  <span className="h-full w-full rounded-full bg-background flex items-center justify-center"><Menu className="h-5 w-5" /></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 1년 진행 막대 — 기록한 날만큼 연두 동그라미가 오른쪽으로 (2026-11-20) */}
        {user && <YearProgressBar />}
        <KakaoInAppNotice />
        <ProofPreview />
        <ConfirmHost />

        {/* Mobile drawer */}
        {/* 2026-11-22: 메뉴를 열면 메뉴만 화면 가득 (아래 페이지 내용은 안 보이게) */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-[95] bg-background overflow-y-auto">
            <div className="container flex justify-end pt-5">
              <button onClick={() => setMobileOpen(false)} className="h-11 w-11 rounded-full p-[2px] bg-primary" aria-label="닫기">
                <span className="h-full w-full rounded-full bg-background flex items-center justify-center"><X className="h-5 w-5" /></span>
              </button>
            </div>
            <nav className="container flex flex-col py-4 gap-3">
              {items.map(item => (
                <Link key={item.path} href={item.path}>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-left flex items-baseline gap-3 py-2"
                  >
                    <span className="editorial-eyebrow text-muted-foreground w-28 shrink-0 whitespace-nowrap">{item.label}</span>
                    <span className="font-serif text-xl">{item.korean}</span>
                  </button>
                </Link>
              ))}
              <div className="pt-3 border-t hairline mt-2">
                <Link href="/profile">
                  <button onClick={() => setMobileOpen(false)} className="w-full text-left flex items-baseline gap-3 py-2">
                    <span className="editorial-eyebrow text-muted-foreground w-20">PROFILE</span>
                    <span className="font-serif text-xl">{user?.name || "프로필"}</span>
                  </button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="container py-8 md:py-12">{children}</main>

      <div className="h-10" />
    </div>
  );
}
