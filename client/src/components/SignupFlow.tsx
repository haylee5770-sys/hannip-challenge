// 가입 (2026-11-22): 환영 → 이름·전화번호 → (명단에 있으면) 내 닉네임 카드 누르기 → 선물 받을 주소 확인 → 개인정보 안내·동의 → 입장
// 명단에 없으면: 닉네임·이메일·주소 직접 입력 → 동의 → '운영자 승인 후 입장' 화면
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import AddressField from "./AddressField";

type Step = "hello" | "pick" | "address" | "manual" | "agree" | "donePreview" | "waitPreview";
const field = "w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none focus:border-primary";
const label = "text-xs font-semibold text-muted-foreground";

export default function SignupFlow({ preview }: { preview?: boolean } = {}) {
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
  const [pvIn, setPvIn] = useState(true); // 미리보기: 명단에 있는 사람으로 볼지

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
    // 미리보기(방장): 위에서 고른 쪽(명단에 있는 사람 / 없는 사람) 흐름을 보여 준다
    if (preview) { if (pvIn) { setMatched(true); setNickname("로제"); setAddress("서울특별시 ○○구 ○○로 12, 101동 1001호"); setEditAddr(false); setStep("pick"); } else { setMatched(false); setStep("manual"); } return; }
    check.mutate({ realName, phone });
  };
  const goSubmit = () => {
    setErr(null);
    if (!a1 || !a2 || !a3) return setErr("동의 항목을 모두 체크해 주세요.");
    if (preview) { setStep(matched ? "donePreview" as Step : "waitPreview" as Step); return; }
    submit.mutate({ realName, phone, nickname: matched ? undefined : nickname, email: email || undefined, address, agreed1: a1, agreed2: a2, privacy: a3 });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full space-y-6 season-fade-in" key={step}>
        {preview && (
          <div className="rounded-2xl bg-amber-400/15 border border-amber-400/50 p-3 space-y-2 text-center">
            <div className="text-xs">👀 <b>방장 미리보기</b> · 아무거나 넣어도 저장되지 않아요</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setPvIn(true); setStep("hello"); }} className={`rounded-xl py-2 text-xs font-bold border ${pvIn ? "bg-amber-400 text-black border-amber-400" : "border-amber-400/50"}`}>명단에 있는 사람</button>
              <button type="button" onClick={() => { setPvIn(false); setStep("hello"); }} className={`rounded-xl py-2 text-xs font-bold border ${!pvIn ? "bg-amber-400 text-black border-amber-400" : "border-amber-400/50"}`}>명단에 없는 사람</button>
            </div>
          </div>
        )}
        {step === "donePreview" && (
          <div className="text-center space-y-4">
            <div className="text-5xl">📷</div>
            <p className="text-sm text-muted-foreground">(실제로는 여기서 프로필 사진·몸 정보 입력 화면이 나오고)</p>
            <div className="text-6xl">🎉</div>
            <h1 className="text-3xl font-black leading-snug">가입이 완료됐어요!<br /><span className="text-primary">축하합니다</span></h1>
            <p className="text-sm text-muted-foreground">이제부터 시작할 수 있어요.<br />나를 칭찬하는 순간, 우리 모두가 1등이 됩니다.</p>
            <Button className="w-full h-12 rounded-2xl glass-btn font-bold" onClick={() => setStep("hello")}>처음부터 다시 보기</Button>
          </div>
        )}
        {step === "waitPreview" && (
          <div className="text-center space-y-4">
            <div className="text-5xl">⏳</div>
            <h1 className="text-2xl font-bold">가입 신청이 접수됐어요</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">1차 신청자 명단에 없어 자동으로 가입되지 않았어요.<br />운영자 승인 후 입장할 수 있어요. 조금만 기다려 주세요!</p>
            <Button className="w-full h-12 rounded-2xl glass-btn font-bold" onClick={() => setStep("hello")}>처음부터 다시 보기</Button>
          </div>
        )}
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
              <h1 className="text-xl font-bold break-keep">앞으로 이벤트에 당첨되면<br />선물을 보내 드릴 주소예요</h1>
              <p className="text-sm text-muted-foreground">지금 미리 확인해 둘게요. 이 주소가 맞나요?</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 space-y-1 text-sm">
              <div><b>{realName}</b> · {phone}</div>
              {editAddr
                ? <AddressField className="mt-2" value={address} onChange={setAddress} />
                : <div className="text-muted-foreground leading-relaxed">{address}</div>}
            </div>
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            {editAddr ? (
              <Button className="w-full h-12 rounded-2xl glass-btn font-bold" onClick={() => { if (!address.trim()) return setErr("주소를 적어 주세요."); setErr(null); setEditAddr(false); }}>이 주소로 저장</Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setEditAddr(true)}>주소를 바꿀래요</Button>
                <Button className="h-12 rounded-2xl glass-btn font-bold" onClick={() => setStep("agree")}>네, 맞아요</Button>
              </div>
            )}
            <p className="text-center text-[11px] text-muted-foreground/70">이 정보는 선물 발송에만 사용해요.</p>
          </div>
        )}

        {step === "manual" && (
          <form onSubmit={e => { e.preventDefault(); setErr(null);
            if (!nickname.trim()) return setErr("닉네임을 적어 주세요.");
            if (!address.trim()) return setErr("주소를 적어 주세요.");
            setStep("agree"); }} className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold">가입 정보를 적어 주세요</h1>
              <p className="text-sm text-muted-foreground">단톡방에서 쓰는 닉네임과 선물 받으실 곳이에요.</p>
            </div>
            <div className="space-y-1"><div className={label}>닉네임</div><input className={field} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} placeholder="예) 배수지" />
              <p className="text-[11px] text-muted-foreground">단톡방 이름에서 몸무게·목표·운동 횟수는 빼고, 닉네임만 적어 주세요.</p></div>
            <div className="space-y-1"><div className={label}>이메일</div><input className={field} value={email} onChange={e => setEmail(e.target.value)} inputMode="email" placeholder="name@example.com" /></div>
            <div className="space-y-1"><div className={label}>주소 (선물 받으실 곳)</div><AddressField value={address} onChange={setAddress} /></div>
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={() => setStep("hello")}>이전</Button>
              <Button type="submit" className="h-12 rounded-2xl glass-btn font-bold">다음</Button>
            </div>
          </form>
        )}

        {step === "agree" && (
          <div className="space-y-5">
            {/* 2026-11-22 해이 확정 문구 */}
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 text-[13px] leading-[1.8] text-foreground/85">
              🔒 <b>모든 기록은 처음 가입한 구글 계정 하나로 모여요.</b><br />
              다른 계정으로 들어오면 기록이 따로 쌓이니, 꼭 이 계정으로 들어와 주세요.
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                <input type="checkbox" checked={a1} onChange={e => setA1(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
                <span className="text-[13.5px] leading-[1.75] text-foreground/90">해이방장의 가이드를 믿고 따르겠습니다. 몸은 반드시 변합니다.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                <input type="checkbox" checked={a3} onChange={e => setA3(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
                <span className="text-[13.5px] leading-[1.75] text-foreground/90">내 정보를 선물 발송, 구매 기록 확인, 계정 찾기에 쓰는 데 동의합니다.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                <input type="checkbox" checked={a2} onChange={e => setA2(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
                <span className="text-[13.5px] leading-[1.75] text-foreground/90">
                  이 앱은 <b>슈퍼한입 챌린지 크루만의 시크릿 공간</b>이에요.
                  <span className="block mt-1.5">- 앱의 기획 · 구성 · 콘텐츠를 무단으로 사용하지 않겠습니다.</span>
                  <span className="block">- 크루들의 기록 등 앱 안의 내용을 캡처해 유포하지 않겠습니다.</span>
                  <span className="block mt-1.5 text-[11px] text-muted-foreground">나의 성과는 '자랑하기'로 카톡방에 정식으로 공유할 수 있으니 마음껏 활용해 주세요. 단, 앱 화면을 직접 캡처하면 내 닉네임이 워터마크로 찍혀요.</span>
                </span>
              </label>
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
