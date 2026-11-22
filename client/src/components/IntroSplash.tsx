// 첫 화면 인트로 (2026-11-22, 해이 요청)
// 링크를 열면 바로: 보라·초록 빛이 번지고 → 가운데 "인생을 바꾸는 가장 쉬운 방법" → "꾸준함이 자존감이 되고…"
// → 연회색으로 바뀌며 크루 사진이 나타나고 → 그 화면 아래에 버튼(크롬으로 열기 / 구글 입장)
// 음악: 휴대폰은 화면을 한 번 누르기 전엔 소리를 막아서, 막히면 누르는 순간 처음부터 들린다.
// 카톡에서 [크롬으로 열기]로 넘어온 경우(주소에 from=kakao)는 인트로를 다시 보여 주지 않는다.
import { useEffect, useRef, useState } from "react";

// 2026-11-22: 인트로 음악 = 해이가 고른 크리스마스 재즈 (client/public/intro/music.m4a, 약 10초). 시즌이 바뀌면 이 파일만 바꾸면 된다
let introAudio: HTMLAudioElement | null = null;
function playIntroMusic() {
  try {
    if (!introAudio) { introAudio = new Audio("/intro/music.m4a"); introAudio.volume = 0.9; }
    const p = introAudio.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* 휴대폰이 막으면 화면을 누를 때 재생 */ });
  } catch { /* 소리 없이 진행 */ }
}

type Phase = "bloom" | "line1" | "line2" | "crew" | "done";
const fromKakao = () => { try { return new URLSearchParams(location.search).get("from") === "kakao"; } catch { return false; } };

/** 연회색 바탕 + 위쪽 크루 사진. 아래에 버튼 등이 들어간다 */
export function CrewScreen({ children, fadeIn }: { children?: React.ReactNode; fadeIn?: boolean }) {
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "linear-gradient(180deg,#b4b4b4 0%,#cfcfcf 22%,#c9c9c9 55%,#a9a9a9 100%)" }}>
      <div className="min-h-full flex flex-col items-center">
        <img src="/intro/crew.jpg" alt="슈퍼한입 챌린지 크루" className={`w-full max-w-[640px] mt-[7vh] ${fadeIn ? "intro-crew-in" : ""}`}
          style={{ WebkitMaskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 86%,transparent 100%)", maskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 86%,transparent 100%)" }} />
        <div className={`-mt-2 text-center text-[13px] font-semibold tracking-[0.18em] text-zinc-700 ${fadeIn ? "season-fade-in" : ""}`} style={fadeIn ? { animationDelay: "1.6s" } : undefined}>
          2025. 1. 24 · 슈퍼바프 1기
          <div className="mt-1 text-[11px] font-medium tracking-[0.12em] text-zinc-600">(슈퍼한입 챌린지 6기)</div>
        </div>
        <div className="w-full max-w-sm px-6 mt-auto pb-[8vh] pt-6">{children}</div>
      </div>
    </div>
  );
}

export default function IntroSplash({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() => {
    try { if (fromKakao() || sessionStorage.getItem("hannipIntro") === "1") return "done"; } catch { /* */ }
    return "bloom";
  });
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (phase === "done") return;
    playIntroMusic(); // 될 때만 소리 (대부분 휴대폰은 화면을 누른 뒤부터)
    // 소리가 막혀 있었으면(멈춘 상태) 처음 누를 때 이어서 재생 — 처음부터 들린다
    const tap = () => { if (introAudio && introAudio.paused) { introAudio.currentTime = 0; playIntroMusic(); } window.removeEventListener("pointerdown", tap); };
    window.addEventListener("pointerdown", tap);
    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    at(500, () => setPhase("line1"));
    at(3700, () => setPhase("line2"));
    at(6900, () => setPhase("crew"));
    at(8800, () => { try { sessionStorage.setItem("hannipIntro", "1"); } catch { /* */ } setPhase("done"); });
    return () => { timers.current.forEach(clearTimeout); window.removeEventListener("pointerdown", tap); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (phase === "done") return <>{children}</>;
  if (phase === "crew") return <CrewScreen fadeIn />;
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#121417] flex items-center justify-center select-none">
      <div className="intro-bloom intro-bloom-on" />
      <div className="relative px-8 text-center flex flex-col items-center">
        <img src="/icons/icon-512.png" alt="슈퍼한입 챌린지" className="intro-icon intro-icon-pop mb-10" />
        <div className="min-h-[96px] flex items-center justify-center">
        {phase === "line1" && <p key="l1" className="intro-line text-[28px] font-black text-white leading-snug">인생을 바꾸는<br />가장 쉬운 방법</p>}
        {phase === "line2" && <p key="l2" className="intro-line text-[22px] font-bold text-white leading-relaxed">꾸준함이 자존감이 되고,<br />자존감이 인생을 바꾼다</p>}
        </div>
      </div>
    </div>
  );
}
