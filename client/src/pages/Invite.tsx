import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { INVITE_TOKEN_STORAGE_KEY } from "@shared/const";

export default function Invite({ token }: { token: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (token) {
      localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
    }
    // Send to root — MembershipGate will handle login or redemption
    const t = setTimeout(() => setLocation("/"), 250);
    return () => clearTimeout(t);
  }, [token, setLocation]);

  return (
    <div className="min-h-screen bg-background paper-grain flex items-center justify-center px-6">
      <div className="text-center">
        <div className="editorial-eyebrow text-muted-foreground mb-4">INVITATION</div>
        <h1 className="editorial-h1 text-4xl md:text-5xl mb-4">
          Welcome to <span className="italic font-serif font-light">super hannip Challenge</span>
        </h1>
        <p className="font-serif italic text-muted-foreground mb-8">초대 토큰을 적용하고 있어요…</p>
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    </div>
  );
}
