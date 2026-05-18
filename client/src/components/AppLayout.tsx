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

const NAV_ITEMS = [
  { label: "TODAY", path: "/today", korean: "오늘" },
  { label: "FEED", path: "/feed", korean: "피드" },
  { label: "RANKING", path: "/ranking", korean: "순위" },
  { label: "DASHBOARD", path: "/dashboard", korean: "대시보드" },
  { label: "MEMBERS", path: "/members", korean: "멤버" },
  { label: "REVEAL", path: "/reveal", korean: "결산" },
  { label: "REPORT", path: "/season-report", korean: "리포트" },
  { label: "ARCHIVE", path: "/archive", korean: "역대 챌린지" },
];

const ADMIN_ITEMS = [
  { label: "ADMIN", path: "/admin", korean: "관리" },
];

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
                  <span className="editorial-eyebrow text-muted-foreground">EST. 2022.05.09</span>
                  <span className="editorial-h2 text-2xl md:text-3xl tracking-tight">
                    super hannip <span className="italic font-serif font-light">Challenge</span>
                  </span>
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
