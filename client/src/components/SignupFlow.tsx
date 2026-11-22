// 가입 (2026-11-22): 환영 → 이름·전화번호 → (명단에 있으면) 내 닉네임 카드 누르기 → 선물 받을 주소 확인 → 개인정보 안내·동의 → 입장
// 명단에 없으면: 닉네임·이메일·주소 직접 입력 → 동의 → '운영자 승인 후 입장' 화면
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Step = "hello" | "pick" | "address" | "manual" | "agree";
const field = "w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none focus:border-primary";
const label = "text-xs font-semibold text-muted-foreground";

export default function SignupFlow() {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<Step>("hello");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [matched, setMatched] = useState(false);
  const [address, setAddress] = useState("");
  const [editAddr, setEditAddr] = useState(false);
  const [email, setEmail] = useState("");
  const [a1, setA1] = useState(false); const [a2, setA2] = useState(false); const [a3, setA3] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = trpc.auth.rosterCheck.useMutation({
    onSuccess: (r) => {
      setErr(null);
      if (r.matched) { setMatched(true); setNickname(r.nickname ?? ""); setAddress(r.address ?? ""); setEditAddr(!r.address); setStep("pick"); }
      else { setMatched(false); setStep("manual"); }
    },
    onError: (e) => setErr(e.message),
  });
  const submit = trpc.auth.submitOnboarding.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); utils.auth.seasonAccess.invalidate(); },
    onError: (e) => setErr(e.message),
  });

  const phoneDigits = phone.replace(/\D/g, "");
  const goCheck = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!realName.trim()) return setErr("이름을 적어 주세요.");
    if (phoneDigits.length < 10) return setErr("전화번호를 끝까지 적어 주세요.");
    check.mutate({ realName, phone });
  };
  const goSubmit = () => {
    setErr(null);
    if (!a1 || !a2 || !a3) return setErr("동의 항목을 모두 체크해 주세요.");
    submit.mutate({ realName, phone, nickname: matched ? undefined : nickname, email: email || undefined, address, agreed1: a1, agreed2: a2, privacy: a3 });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full space-y-6 season-fade-in" key={step}>
        {step === "hello" && (
          <form onSubmit={goCheck} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl">👋</div>
              <h1 className="text-2xl font-black">안녕하세요, 환영합니다!</h1>
              <p className="text-sm text-muted-foreground">가입을 진행해 주세요.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1"><div className={label}>이름 (스무디 주문할 때 쓴 이름)</div>
                <input className={field} value={realName} onChange={e => setRealName(e.target.value)} placeholder="홍길동" autoComplete="name" /></div>
              <div className="space-y-1"><div className={label}>전화번호</div>
                <input className={field} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" /></div>
            </div>
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            <Button type="submit" disabled={check.isPending} className="w-full h-12 rounded-2xl glass-btn text-base font-bold">
              {check.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "다음"}
            </Button>
          </form>
        )}

        {step === "pick" && (
          <div className="space-y-6 text-center">
            <h1 className="text-xl font-bold">{realName} 님, 이 닉네임이 맞나요?</h1>
            <p className="text-sm text-muted-foreground">눌러서 선택해 주세요</p>
            <button type="button" onClick={() => setStep("address")}
              className="w-full rounded-3xl border-2 border-primary bg-primary/10 py-8 text-3xl font-black text-primary active:scale-[0.98] transition">
              {nickname}
            </button>
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setStep("hello")}>제 닉네임이 아니에요</button>
          </div>
        )}

        {step === "address" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="text-4xl">🎁</div>
              <h1 className="text-xl font-bold">선물 받으실 곳이 여기 맞나요?</h1>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 space-y-1 text-sm">
              <div><b>{realName}</b> · {phone}</div>
              {editAddr
                ? <textarea className={field + " mt-2 resize-none"} rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="받으실 주소 (동·호수까지)" />
                : <div className="text-muted-foreground leading-relaxed">{address}</div>}
            </div>
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            {editAddr ? (
              <Button className="w-full h-12 rounded-2xl glass-btn font-bold" onClick={() => { if (!address.trim()) return setErr("주소를 적어 주세요."); setErr(null); setEditAddr(false); }}>이 주소로 저장</Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setEditAddr(true)}>다른 곳에서 받을래요</Button>
                <Button className="h-12 rounded-2xl glass-btn font-bold" onClick={() => setStep("agree")}>네, 맞아요</Button>
              </div>
            )}
          </div>
        )}

        {step === "manual" && (
          <form onSubmit={e => { e.preventDefault(); setErr(null);
            if (!nickname.trim()) return setErr("닉네임을 적어 주세요.");
            if (!address.trim()) return setErr("주소를 적어 주세요.");
            setStep("agree"); }} className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold">정보를 조금만 더 적어 주세요</h1>
              <p className="text-sm text-muted-foreground">단톡방에서 쓰는 닉네임과 선물 받으실 곳이에요.</p>
            </div>
            <div className="space-y-1"><div className={label}>닉네임</div><input className={field} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} placeholder="단톡방 닉네임" /></div>
            <div className="space-y-1"><div className={label}>이메일</div><input className={field} value={email} onChange={e => setEmail(e.target.value)} inputMode="email" placeholder="name@example.com" /></div>
            <div className="space-y-1"><div className={label}>주소 (선물 받으실 곳)</div><textarea className={field + " resize-none"} rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="동·호수까지 적어 주세요" /></div>
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={() => setStep("hello")}>이전</Button>
              <Button type="submit" className="h-12 rounded-2xl glass-btn font-bold">다음</Button>
            </div>
          </form>
        )}

        {step === "agree" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm leading-relaxed">
              🔒 적어 주신 <b>이름 · 전화번호 · 주소</b>는 <b>선물 발송</b>과 <b>구매 기록 확인</b>에만 쓰여요.<br />
              로그인한 <b>구글 이메일</b>은 계정을 잊었을 때 찾아 드리려고 방장만 볼 수 있게 저장해요.<br />
              같은 정보로 기록이 모이니, 바뀌면 꼭 프로필에서 고쳐 주세요.
            </div>
            <div className="space-y-3">
              {([[a1, setA1, "해이방장의 가이드를 믿고 따르겠습니다. 몸은 반드시 변합니다."],
                 [a2, setA2, "가이드를 지키지 않으면 결과를 보장받을 수 없음을 이해합니다."],
                 [a3, setA3, "위 개인정보(이름·전화번호·주소·로그인 구글 이메일)를 선물 발송·구매 기록 확인·계정 찾기에 쓰는 데 동의합니다."]] as const).map(([v, set, t], i) => (
                <label key={i} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={v} onChange={e => set(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" />
                  <span className="text-sm leading-relaxed">{t}</span>
                </label>
              ))}
            </div>
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            <Button disabled={submit.isPending} className="w-full h-12 rounded-2xl glass-btn text-base font-bold" onClick={goSubmit}>
              {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : matched ? "입장하기" : "가입 신청하기"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
