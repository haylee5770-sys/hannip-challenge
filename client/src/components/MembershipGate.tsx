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
import IntroSplash, { CrewScreen, stopIntroMusic } from "./IntroSplash";

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

  // 2026-11-22: 크루 사진 화면 + 아래 큰 버튼 하나. 안 열릴 때만 쓰는 '링크 복사'는 작게
  return (
    <CrewScreen>
      <div className="text-center space-y-3">
        <button type="button" onClick={() => { stopIntroMusic(); openInExternalBrowser(); }} className="black-glass w-full h-16 rounded-full border border-white/25 text-white text-lg font-black active:scale-[0.98] transition">
          {isIOS ? "사파리로 열기" : "크롬으로 열기"}
        </button>
        <button type="button" onClick={handleCopy} className="text-xs text-zinc-600 underline">
          {copied ? `✓ 복사됐어요. ${isIOS ? "사파리" : "크롬"} 주소창에 붙여 넣어 주세요` : "버튼을 눌러도 안 열리면 → 링크 복사하기"}
        </button>
      </div>
    </CrewScreen>
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
  if (isInAppBrowser()) return <IntroSplash><InAppBrowserBlock /></IntroSplash>;

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
      <IntroSplash>
        <CrewScreen>
          <div className="space-y-3 text-center">
            <Button type="button" onClick={() => { stopIntroMusic(); handleGoogleLogin(); }} disabled={authLoading}
              className="black-glass w-full h-16 rounded-full border border-white/25 text-white text-lg font-black">
              {authLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.9h5.36c-.23 1.5-1.6 4.4-5.36 4.4-3.23 0-5.86-2.67-5.86-5.95S8.77 7.5 12 7.5c1.84 0 3.07.78 3.78 1.45l2.58-2.49C16.78 4.96 14.6 4 12 4 6.98 4 3 8 3 13s3.98 9 9 9c5.2 0 8.64-3.65 8.64-8.78 0-.59-.06-1.04-.13-1.49z"/></svg>
              )}
              Google 계정으로 입장하기
            </Button>
            {authError && <p className="text-xs text-red-700">{authError}</p>}
            <p className="text-xs text-zinc-600 leading-relaxed">단톡방 크루만 들어올 수 있어요.<br />아이폰을 쓰시면 구글 계정이 필요해요 (없으면 먼저 만들어 주세요).</p>
          </div>
        </CrewScreen>
      </IntroSplash>
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
