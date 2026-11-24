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
import { Menu, X, ChevronRight, Users, Trophy, Medal, ShoppingBag, Gift, Palette, KeyRound, BookOpen } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";
import { isKakaoInApp, openInExternalBrowser } from "@/lib/proofCard";
import type { ConfirmReq } from "@/lib/askConfirm";
import { askConfirm } from "@/lib/askConfirm";
import BragSheet from "@/components/BragSheet";
import NoticePopup from "@/components/NoticePopup";

// 2026-11-22 방장 지정 순서 · 묶음: act 활동 / buy 구매·신청(연두) / me 꾸미기·프로필(베이지) / 관리(방장만, 하늘색)
const NAV_ITEMS = [
  { label: "TODAY", path: "/today", korean: "오늘", group: "act" },
  { label: "YEAR", path: "/year", korean: "1년", group: "act" },
  { label: "ITGE", path: "/itge", korean: "이게돼", group: "act" },
  { label: "MY CHANGE", path: "/dashboard", korean: "나의 변화", group: "act" },
  { label: "BEFORE·AFTER", path: "/before-after", korean: "비포 애프터", group: "act" },
  { label: "AWARDS", path: "/awards", korean: "시상식", group: "act" },
  { label: "HISTORY", path: "/history", korean: "명예의 전당", group: "act" },
  { label: "MEMBERS", path: "/members", korean: "멤버", group: "act" },
  { label: "SHOP", path: "/shop", korean: "구매하기", group: "buy" },
  { label: "APPLY", path: "/apply", korean: "신청하기", group: "buy" },
  { label: "STYLE", path: "/decor", korean: "꾸미기", group: "me" },
];

const ADMIN_ITEMS = [
  { label: "ADMIN", path: "/admin", korean: "관리", group: "admin" },
];
const GROUP_COLOR: Record<string, string> = { act: "", buy: "#b6f24a", me: "#e8c9a0", admin: "#7cc4ff" };

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
        {imgs.map((src, i) => <img key={i} src={src} alt={`인증 사진 ${i + 1}`} className="w-full rounded-2xl allow-save" />)}
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

/**
 * 새 시즌 대기 잠금 (2026-11-24 해이): 예약 시즌이 시작되기 전(진행 중 시즌 없음 + 예약 있음)에는
 * 크루 화면을 통째로 가리고 무엇을 눌러도 이 안내만 보인다. 예약 시각에 시즌이 시작되면 자동으로 풀림. 방장은 통과
 */
function WaitLock({ isAdmin }: { isAdmin: boolean }) {
  const q = trpc.rounds.waitLock.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  if (!q.data?.locked) return null;
  const when = q.data.startAt ? new Date(q.data.startAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  if (isAdmin) return (
    <div className="bg-amber-400 text-black text-center text-xs font-bold py-1.5 px-3">🔒 지금 크루 화면은 '새 시즌 대기 중'으로 잠겨 있어요 · {when} 자동으로 풀려요 (방장만 보임)</div>
  );
  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur flex items-center justify-center p-8 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)" }} onClickCapture={e => e.stopPropagation()}>
      <div className="max-w-xs space-y-4">
        <div className="text-6xl">🌙</div>
        <h2 className="text-2xl font-black leading-snug">지금은<br /><span className="text-primary">새 시즌 대기 중</span>입니다</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {q.data.name ? <><b className="text-foreground">{q.data.name}</b>이</> : "새 시즌이"} <b className="text-foreground">{when}</b>에 시작돼요.<br />
          그때부터 모든 인증이 <b className="text-primary">1번</b>부터 시작해요!
        </p>
        <button type="button" onClick={() => q.refetch()} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">다시 확인하기</button>
      </div>
    </div>
  );
}

/** 시즌별 몸무게 (2026-11-22): 시즌 시작 때 한 번 + 끝나기 전 마지막 3일에 한 번. 기록하면 사라짐 */
function WeighInBanner() {
  const q = trpc.rounds.weighStatus.useQuery(undefined, { staleTime: 10 * 60_000, retry: false });
  const lock = trpc.rounds.waitLock.useQuery(undefined, { staleTime: 60_000 });
  if (!q.data?.need || lock.data?.locked) return null; // 새 시즌 대기 중에는 빨간 띠를 안 보여 줌
  return (
    <Link href="/today#weight">
      <div className="bg-rose-600 text-white text-center text-sm font-bold py-2 px-3 cursor-pointer">
        {/* 2026-11-24 해이 확정 문구 */}
        {q.data.need === "start"
          ? <>⚖️ 새 시즌의 시작, 몸무게를 기록해 주세요<br />
              <span className="font-medium text-[12px] leading-snug">아침 공복에 재고 체중계 사진을 올려 주세요.<br />몸무게는 시즌 시작·끝, 딱 2번만 재요.<br />📸 비포 애프터 사진도 오늘 찍어서 올려 두면 좋아요!</span></>
          : <>⚖️ 시즌 마무리, 마지막 몸무게를 기록해 주세요<br />
              <span className="font-medium text-[12px] leading-snug">아침 공복에 재고 체중계 사진을 올려 주세요.<br />몸무게는 시즌 시작·끝, 딱 2번만 재요.<br />📸 비포 애프터 사진도 같이 찍어서 올려 두면 좋아요!</span></>}
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

/** 이름 워터마크 (2026-11-22): 화면 전체에 보는 사람 닉네임을 아주 옅게 비스듬히. 캡처하면 이름이 같이 찍힘. 누르는 데는 방해 안 됨.
 *  '자랑하기'로 만드는 인증 카드(캔버스 이미지)에는 들어가지 않는다 */
function NameWatermark({ name }: { name: string }) {
  const t = (name || "").replace(/[<>&"]/g, "").slice(0, 20);
  if (!t) return null;
  // 2026-11-22: 글자는 똑바로, 판 전체를 비스듬히 기울여서 모든 이름이 같은 간격(엇갈린 벽돌 모양). 작게·아주 옅게
  const w = Math.max(190, t.length * 14 + 120), h = 120;
  const tx = (x: number, y: number) => `<text x='${x}' y='${y}' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-size='13' font-weight='700' fill='white'>${t}</text>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${tx(w * 0.25, h * 0.25)}${tx(w * 0.75, h * 0.75)}</svg>`;
  return (
    <div aria-hidden className="fixed inset-0 z-[85] pointer-events-none select-none overflow-hidden" style={{ opacity: 0.018 }}>
      <div className="absolute -inset-1/2" style={{ transform: "rotate(-24deg)", backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, backgroundRepeat: "repeat" }} />
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
  const unseenReplies = trpc.crew.unseenReplies.useQuery(undefined, { enabled: !!user && user.status === "approved", staleTime: 5 * 60_000 });
  // 2026-11-23: 메뉴가 열려 있는 동안 뒤 화면(오늘)이 스크롤을 가져가지 않게 잠근다 (아이폰에서 메뉴가 안 움직였음)
  useEffect(() => {
    if (!mobileOpen) return;
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    return () => { html.style.overflow = prev[0]; body.style.overflow = prev[1]; };
  }, [mobileOpen]);

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

  // 2026-11-24 해이: 뒤로 가기를 누르다 앱이 꺼지는 문제 → 다른 화면에서 뒤로 = '오늘' 화면,
  // '오늘'에서 한 번 더 뒤로 = "앱을 종료할까요?" 묻고 [종료]를 눌러야만 나간다
  const locRef = useRef(location);
  locRef.current = location;
  useEffect(() => {
    const GUARD = { hannipGuard: 1 };
    const baseLen = history.length; // 앱을 연 순간의 기록 개수 → 종료할 때 앱 안 기록을 한꺼번에 건너뛰려고 (2026-11-25 카즈하 의견)
    const push = () => { try { history.pushState(GUARD, ""); } catch {} };
    if (!(history.state && history.state.hannipGuard)) push();
    let asking = false;
    const onPop = async () => {
      const path = window.location.pathname;
      if (path !== "/today" && path !== "/") { navigate("/today", { replace: true }); push(); return; }
      if (locRef.current !== "/today" && locRef.current !== "/") { push(); return; } // 다른 화면에서 '오늘'로 돌아온 것
      if (asking) return;
      asking = true;
      const ok = await askConfirm("앱을 종료할까요?", "종료");
      asking = false;
      if (ok) {
        window.removeEventListener("popstate", onPop);
        try { window.close(); } catch {}
        // 앱 안에서 쌓인 화면 기록을 한 번에 지나 앱 밖으로 (한 칸만 돌아가 '오늘'이 다시 뜨던 문제)
        history.go(-Math.max(1, history.length - baseLen + 1));
      }
      else push();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = user?.role === "admin";
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;

  return (
    // 2026-11-23: 아이폰 바탕화면 앱은 화면이 시계·배터리 줄 밑까지 올라가서(black-translucent) 프로필 버튼이 안 눌렸다
    // → 그 높이(safe-area-inset-top)만큼 내려 준다. 인터넷 창에서는 0이라 그대로.
    <div className="min-h-screen bg-background paper-grain" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Top masthead */}
      <WaitLock isAdmin={user?.role === "admin"} />
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
        <BragSheet />
        <NoticePopup />
        <ConfirmHost />

        {/* Mobile drawer */}
        {/* 2026-11-22: 메뉴를 열면 메뉴만 화면 가득 (아래 페이지 내용은 안 보이게) */}
        {mobileOpen && (
          // 2026-11-23: 아이폰 바탕화면 앱에서 X가 시계 줄 밑에 붙어 안 눌림 → 위·아래 안전 여백, 메뉴 안에서만 스크롤
          <div className="md:hidden fixed inset-0 z-[95] bg-background overflow-y-auto overscroll-contain"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", WebkitOverflowScrolling: "touch" }}>
            <div className="container flex justify-end pt-4">
              <button onClick={() => setMobileOpen(false)} className="h-9 w-9 rounded-full p-[1.5px] bg-primary" aria-label="닫기">
                <span className="h-full w-full rounded-full bg-background flex items-center justify-center"><X className="h-4 w-4" /></span>
              </button>
            </div>
            {/* 2026-11-22 메뉴 C-2 (해이 확정): 위 [프로필 수정][앱 꾸미기] 블랙 유리알 두 칸 / MY 유리 막대 / CREW 타일 / 아래 구매·신청 유리알 + 관리 버튼 */}
            <nav className="container flex flex-col pb-8" style={{ minHeight: "calc(100dvh - 4.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}>
              <div className="grid grid-cols-2 gap-2.5 mt-2">
                <Link href="/profile">
                  <button onClick={() => setMobileOpen(false)} className="glass-btn w-full h-12 flex items-center justify-center gap-2 text-[15px]">
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt="" className="relative z-[1] h-7 w-7 rounded-full object-cover border-2 border-white/80" />
                      : <span className="relative z-[1] h-7 w-7 rounded-full bg-muted border-2 border-white/80" />}
                    <span className="relative z-[1]">프로필 수정</span>
                  </button>
                </Link>
                <Link href="/decor">
                  <button onClick={() => setMobileOpen(false)} className="glass-btn w-full h-12 flex items-center justify-center gap-2 text-[15px]">
                    <Palette className="relative z-[1] h-5 w-5" /><span className="relative z-[1]">앱 꾸미기</span>
                  </button>
                </Link>
              </div>

              <div className="editorial-eyebrow text-primary mt-7 mb-2 px-1">MY</div>
              <div className="flex flex-col gap-2">
                {items.filter(i => i.group === "act" && !["/members", "/awards", "/history"].includes(i.path)).map(item => (
                  <Link key={item.path} href={item.path}>
                    <button onClick={() => setMobileOpen(false)}
                      className="relative overflow-hidden w-full h-12 rounded-2xl flex items-center justify-between px-4 border border-white/20"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.04) 55%, rgba(255,255,255,.07))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 4px 12px rgba(0,0,0,.18)", backdropFilter: "blur(10px)" }}>
                      <span aria-hidden className="pointer-events-none absolute left-3 right-3 top-[2px] h-[38%] rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0))" }} />
                      <span className="relative text-[17px] font-medium">{item.korean}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </Link>
                ))}
              </div>

              <div className="editorial-eyebrow text-primary mt-7 mb-2 px-1">CREW</div>
              {/* 2026-11-23 해이: 사용설명서도 멤버·시상식·명예의 전당과 같은 칸으로 */}
              <div className="grid grid-cols-4 gap-2">
                {([["/members", "멤버", Users], ["/awards", "시상식", Trophy], ["/history", "명예의 전당", Medal], ["/manual", "사용설명서", BookOpen]] as const).map(([path, label, Icon]) => (
                  <Link key={path} href={path}>
                    <button onClick={() => setMobileOpen(false)} className="w-full rounded-2xl bg-card border border-primary/25 py-3.5 flex flex-col items-center gap-1.5">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-[12px] whitespace-nowrap">{label}</span>
                    </button>
                  </Link>
                ))}
              </div>

              <div className="flex-1 min-h-6" />

              <div className="grid grid-cols-2 gap-2.5">
                {([["/shop", "구매하기", ShoppingBag], ["/apply", "신청하기", Gift]] as const).map(([path, label, Icon]) => (
                  <Link key={path} href={path}>
                    <button onClick={() => setMobileOpen(false)} className="glass-btn w-full h-12 text-[15px] flex items-center justify-center gap-1.5">
                      <Icon className="h-4 w-4 relative z-[1]" /><span className="relative z-[1]">{label}</span>
                      {/* 2026-11-23: 의견에 방장 답장이 새로 오면 '신청하기'에 빨간 점 */}
                      {path === "/apply" && (unseenReplies.data ?? 0) > 0 && <span className="relative z-[1] h-2.5 w-2.5 rounded-full bg-rose-500" aria-label="새 답장" />}
                    </button>
                  </Link>
                ))}
              </div>

              {isAdmin && (
                <Link href="/admin">
                  <button onClick={() => setMobileOpen(false)} className="mt-2.5 w-full h-11 rounded-full flex items-center justify-center gap-1.5 text-sm font-semibold"
                    style={{ color: "var(--primary)", background: "rgba(255,255,255,.06)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)" }}>
                    <KeyRound className="h-4 w-4" /> 관리 <span className="text-[11px] opacity-70">방장만</span>
                  </button>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="container py-8 md:py-12">{children}</main>
      {user && <NameWatermark name={user.name ?? ""} />}

      <div className="h-10" />
    </div>
  );
}
