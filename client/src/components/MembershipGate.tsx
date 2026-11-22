import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import ProfileSetup from "./ProfileSetup";
import SignupFlow from "./SignupFlow";
import SeasonStart from "./SeasonStart";
import { openInExternalBrowser } from "@/lib/proofCard";
import InstallButton from "./InstallButton";

/** 카카오톡·라인 등 인앱 브라우저 여부 판별 */
function isInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("kakaotalk") ||
    ua.includes("line/") ||
    ua.includes("instagram") ||
    ua.includes("fbav") || // Facebook
    // Android WebView 공통 마커
    (ua.includes("android") && ua.includes("; wv)"))
  );
}

function InAppBrowserBlock() {
  const url = window.location.href;
  const [copied, setCopied] = useState(false);
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isKakao = ua.includes("kakaotalk");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // 구형 기기 fallback
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // 2026-11-22: 큰 버튼 하나. 안 열릴 때만 쓰는 '링크 복사'는 맨 아래 작게
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div>
          <div className="text-5xl mb-3">💚</div>
          <h1 className="text-[26px] font-black leading-snug">환영합니다!</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-5">슈퍼한입 챌린지에 오신 걸 환영해요.</p>
          <h2 className="text-lg font-bold leading-snug">먼저 {isIOS ? "사파리" : "크롬"}에서 열어 주세요</h2>
          <p className="text-sm text-muted-foreground mt-2">{isKakao ? "카카오톡" : "이 앱"} 안에서는 입장할 수 없어요.</p>
        </div>
        <button type="button" onClick={openInExternalBrowser} className="w-full h-16 rounded-3xl glass-btn text-lg font-black active:scale-[0.98] transition">
          {isIOS ? "사파리로 열기" : "크롬으로 열기"}
        </button>
        <button type="button" onClick={handleCopy} className="text-xs text-muted-foreground underline">
          {copied ? `✓ 복사됐어요. ${isIOS ? "사파리" : "크롬"} 주소창에 붙여 넣어 주세요` : "버튼을 눌러도 안 열리면 → 링크 복사하기"}
        </button>
      </div>
    </div>
  );
}

function toKoreanError(msg: string): string {
  if (!msg) return "오류가 발생했어요. 다시 시도해 주세요.";
  const m = msg.toLowerCase();
  if (m.includes("popup_closed") || m.includes("popup closed")) return "로그인 창이 닫혔어요. 다시 시도해 주세요.";
  if (m.includes("cancelled") || m.includes("canceled")) return "로그인이 취소됐어요. 다시 시도해 주세요.";
  if (m.includes("network") || m.includes("fetch")) return "네트워크 오류예요. 인터넷 연결을 확인해 주세요.";
  if (m.includes("rate limit")) return "너무 많은 시도를 했어요. 잠시 후 다시 시도해 주세요.";
  return "오류가 발생했어요. 다시 시도해 주세요.";
}

export default function MembershipGate({ children }: { children: React.ReactNode }) {
  // 2026-11-22: 입장은 구글 하나만 → 카톡·인스타 등 앱 안 브라우저에서는 크롬(아이폰은 사파리)으로 옮겨 열게 한다
  if (isInAppBrowser()) return <InAppBrowserBlock />;

  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 시즌 접근 권한 확인
  const seasonAccess = trpc.auth.seasonAccess.useQuery(undefined, {
    enabled: !!user && user.status === "approved",
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 기존 멤버 입장코드 입력
  const [returningCode, setReturningCode] = useState("");
  const [returningError, setReturningError] = useState<string | null>(null);

  const enterSeasonCode = trpc.auth.enterSeasonCode.useMutation({
    onSuccess: () => { utils.auth.seasonAccess.invalidate(); },
    onError: (e) => { setReturningError(e.message); },
  });

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(toKoreanError(error.message));
    setAuthLoading(false);
  };

  const handleKakaoLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: window.location.origin,
        scopes: "profile_nickname profile_image",
      },
    });
    if (error) setAuthError(toKoreanError(error.message));
    setAuthLoading(false);
  };

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background paper-grain flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── 비로그인 ──
  if (!user) {
    return (
      <div className="min-h-screen bg-background paper-grain flex items-center justify-center px-6">
        <div className="max-w-sm w-full">
          {/* 2026-11-22: 처음 들어오면 환영 인사부터 */}
          <div className="text-center mb-8 space-y-3 season-fade-in">
            <div className="text-5xl">💚</div>
            <h1 className="text-[26px] font-black leading-snug">환영합니다!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">슈퍼한입 챌린지</span>에 오신 걸 환영해요.<br />
              꾸준함이 자존감이 되고, 자존감이 인생을 바꿔요.
            </p>
            <div className="pt-2 text-xs text-primary font-medium">인생을 바꾸는 가장 쉬운 방법</div>
            <div className="editorial-h2 text-2xl tracking-tight">super hannip <span className="italic font-serif font-light">Challenge</span></div>
          </div>
          <div className="rounded-3xl border border-white/10 p-6 space-y-3 season-fade-in" style={{ animationDelay: ".4s" }}>
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full h-12 rounded-2xl glass-btn font-bold"
            >
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M21.35 11.1H12v3.9h5.36c-.23 1.5-1.6 4.4-5.36 4.4-3.23 0-5.86-2.67-5.86-5.95S8.77 7.5 12 7.5c1.84 0 3.07.78 3.78 1.45l2.58-2.49C16.78 4.96 14.6 4 12 4 6.98 4 3 8 3 13s3.98 9 9 9c5.2 0 8.64-3.65 8.64-8.78 0-.59-.06-1.04-.13-1.49z"/>
                </svg>
              )}
              Google 계정으로 입장하기
            </Button>
            <InstallButton />
            {authError && <p className="text-xs text-destructive text-center">{authError}</p>}
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              단톡방 크루만 들어올 수 있어요.<br />아이폰을 쓰시면 구글 계정이 필요해요 (없으면 먼저 만들어 주세요).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 거절 ──
  if (user.status === "rejected") {
    return (
      <div className="min-h-screen bg-background paper-grain flex items-center justify-center px-6">
        <div className="max-w-xl w-full text-center">
          <div className="editorial-eyebrow text-muted-foreground mb-4">ACCESS DENIED</div>
          <h1 className="editorial-h1 text-4xl md:text-5xl mb-6">입장이 거절되었습니다</h1>
          <p className="font-serif italic text-lg text-muted-foreground">방장에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  // ── 신청은 했고 방장 수락을 기다리는 중 (2026-11-22 문구) ──
  if (user.status === "pending" && (user as any).onboardingDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4 season-fade-in">
          <div className="text-5xl">⏳</div>
          <h1 className="text-2xl font-bold leading-snug">가입 신청이 접수됐어요</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">1차 신청자 명단에 없어 자동으로 가입되지 않았어요.<br />운영자 승인 후 입장할 수 있어요. 조금만 기다려 주세요!</p>
          <Button variant="outline" className="rounded-2xl" onClick={() => location.reload()}>새로고침</Button>
        </div>
      </div>
    );
  }

  // ── 신규 멤버 — 가입 (2026-11-22: 명단 대조) ──
  if (user.status !== "approved") return <SignupFlow />;

  // ── 승인된 멤버 — 시즌 접근 권한 확인 ──
  if (seasonAccess.isLoading) {
    return (
      <div className="min-h-screen bg-background paper-grain flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 시즌이 있는데 코드를 아직 안 입력한 경우 (기존 멤버 or 시즌 종료 후 새 시즌)
  if (seasonAccess.data && !seasonAccess.data.hasAccess && seasonAccess.data.season) {
    const season = seasonAccess.data.season;
    return (
      <div className="min-h-screen bg-background paper-grain flex items-center justify-center px-6">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <div className="editorial-eyebrow text-muted-foreground mb-3">NEW SEASON</div>
            <h1 className="editorial-h1 text-3xl md:text-4xl mb-2">
              새 시즌이 시작됐어요
            </h1>
            <p className="font-serif italic text-muted-foreground text-sm mb-1">{season.name}</p>
            <p className="text-sm text-muted-foreground">
              {season.startDate} → {season.endDate}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              이번 시즌 코드를 입력하면 바로 활동할 수 있어요.
            </p>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              setReturningError(null);
              if (!returningCode.trim()) { setReturningError("입장코드를 입력해 주세요."); return; }
              enterSeasonCode.mutate({ seasonCode: returningCode });
            }}
            className="border hairline p-6 space-y-4"
          >
            <input
              type="text"
              placeholder="이번 시즌 코드"
              value={returningCode}
              onChange={e => setReturningCode(e.target.value)}
              className="w-full border border-foreground/30 bg-background px-3 py-2 text-sm outline-none focus:border-foreground tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case"
            />
            {returningError && <p className="text-xs text-destructive">{returningError}</p>}
            <Button type="submit" disabled={enterSeasonCode.isPending} className="w-full rounded-none uppercase tracking-wider">
              {enterSeasonCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "활동 시작하기"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <ProfileSetup><SeasonStart>{children}</SeasonStart></ProfileSetup>;
}
