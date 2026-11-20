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

const NAV_ITEMS = [
  // 2026-11-20 방장 요청: 피드·순위·리포트 메뉴 빼고(리포트는 대시보드로 합침) 구매하기 추가
  { label: "TODAY", path: "/today", korean: "오늘" },
  { label: "DASHBOARD", path: "/dashboard", korean: "대시보드" },
  { label: "MEMBERS", path: "/members", korean: "멤버" },
  { label: "REVEAL", path: "/reveal", korean: "결산" },
  { label: "ARCHIVE", path: "/archive", korean: "역대 챌린지" },
  { label: "SHOP", path: "/shop", korean: "구매하기" },
];

const ADMIN_ITEMS = [
  { label: "ADMIN", path: "/admin", korean: "관리" },
];

function YearProgressBar() {
  const q = trpc.happy.yearProgress.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const days = q.data?.days ?? 0;
  const total = q.data?.total ?? 365;
  const pct = Math.min(100, (days / total) * 100);
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
        <span>나의 {q.data?.year ?? new Date().getFullYear()}년</span>
        <span>올해 <b className="text-primary">{days}</b>일 기록했어요 · {total}일</span>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-background paper-grain">
      {/* Top masthead */}
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
                      {item.label}
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <span className="font-serif text-base">로그아웃</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => setMobileOpen(v => !v)}
                className="md:hidden p-2"
                aria-label="menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* 1년 진행 막대 — 기록한 날만큼 연두 동그라미가 오른쪽으로 (2026-11-20) */}
        {user && <YearProgressBar />}

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t hairline">
            <nav className="container flex flex-col py-4 gap-3">
              {items.map(item => (
                <Link key={item.path} href={item.path}>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-left flex items-baseline gap-3 py-2"
                  >
                    <span className="editorial-eyebrow text-muted-foreground w-20">{item.label}</span>
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
                <Button
                  variant="ghost"
                  onClick={() => { setMobileOpen(false); logout(); }}
                  className="w-full justify-start font-serif text-base mt-1"
                >
                  로그아웃
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="container py-8 md:py-12">{children}</main>

      <footer className="border-t hairline mt-16">
        <div className="container py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <span className="editorial-eyebrow text-muted-foreground">
            SUPER HANNIP CHALLENGE · MEMBERS ONLY
          </span>
          <span className="font-serif italic text-sm text-muted-foreground">
            "꾸준함이 곧 우아함이다."
          </span>
        </div>
      </footer>
    </div>
  );
}
