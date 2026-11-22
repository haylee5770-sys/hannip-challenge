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
    if (!introAudio) { introAudio = new Audio("/intro/music.m4a"); introAudio.volume = 0.9; introAudio.loop = true; }
    const p = introAudio.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* 휴대폰이 막으면 화면을 누를 때 재생 */ });
  } catch { /* 소리 없이 진행 */ }
}

/** 버튼(크롬으로 열기 / 구글 입장)을 누르면 음악을 천천히 줄이며 멈춘다 */
export function stopIntroMusic() {
  const a = introAudio; if (!a) return;
  const step = () => { if (a.volume > 0.08) { a.volume = Math.max(0, a.volume - 0.08); setTimeout(step, 60); } else { a.pause(); } };
  step();
}

/** 사진 속 크루 닉네임 — 왼쪽부터 얼굴 훑는 순서 (해이 지정 2026-11-22) */
const CREW_NAMES = [
  { name: "혜교", x: 27.0, y: 48 },
  { name: "지연", x: 35.0, y: 48 },
  { name: "해이", x: 52.2, y: 48 },
  { name: "카리나", x: 59.9, y: 48 },
  { name: "수지", x: 68.2, y: 48 },
  { name: "청하", x: 80.8, y: 48 },
];

type Phase = "bloom" | "line1" | "line2" | "crew" | "done";
const fromKakao = () => { try { return new URLSearchParams(location.search).get("from") === "kakao"; } catch { return false; } };

/** 연회색 바탕 + 위쪽 크루 사진. 아래에 버튼 등이 들어간다 */
export function CrewScreen({ children, fadeIn }: { children?: React.ReactNode; fadeIn?: boolean }) {
  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden" style={{ background: "linear-gradient(180deg,#b4b4b4 0%,#cfcfcf 22%,#c9c9c9 55%,#a9a9a9 100%)" }}>
      <div className="min-h-full flex flex-col items-center">
        {/* 사진 + 머리 위 이름(사진에 미리 써 있는 것처럼). 인트로에서는 확대된 채 왼쪽→오른쪽으로 천천히, 끝나면 작아지며 제자리 */}
        <div className={`relative w-[130%] max-w-[832px] shrink-0 mt-[7vh] ${fadeIn ? "intro-crew-in" : ""}`}>
          <img src="/intro/crew.jpg" alt="슈퍼한입 챌린지 크루" className="w-full block"
            style={{ WebkitMaskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 86%,transparent 100%)", maskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 86%,transparent 100%)" }} />
          {fadeIn && CREW_NAMES.map(c => (
            <span key={c.name} className="intro-crew-name absolute -translate-x-1/2 -translate-y-[150%] whitespace-nowrap" style={{ left: `${c.x}%`, top: `${c.y}%` }}>{c.name}</span>
          ))}
        </div>
        <div className={`-mt-2 text-center text-[13px] font-semibold tracking-[0.18em] text-zinc-700 ${fadeIn ? "season-fade-in" : ""}`} style={fadeIn ? { animationDelay: "10.2s" } : undefined}>
          2025. 1. 24 · 슈퍼바프 1기
          <div className="mt-1 text-[11px] font-medium tracking-[0.12em] text-zinc-600">— 슈퍼한입 챌린지 6기 —</div>
        </div>
        <div className="w-full max-w-sm px-6 mt-auto pb-[16vh] pt-6">{children}</div>
      </div>
    </div>
  );
}

export default function IntroSplash({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() => {
    try {
      // 확인용: 주소 끝에 ?intro=1 이 있으면 언제나 처음부터 보여 준다 (2026-11-22)
      if (new URLSearchParams(location.search).get("intro") === "1") return "bloom";
      if (fromKakao() || sessionStorage.getItem("hannipIntro") === "1") return "done";
    } catch { /* */ }
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
    at(5100, () => setPhase("line2"));
    at(9700, () => setPhase("crew"));
    at(21000, () => { try { sessionStorage.setItem("hannipIntro", "1"); } catch { /* */ } setPhase("done"); });
    return () => { timers.current.forEach(clearTimeout); window.removeEventListener("pointerdown", tap); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (phase === "done") return <>{children}</>;
  // 같은 화면(보라·초록 + 아이콘)을 그대로 둔 채 천천히 걷어 내면, 아래에서 크루 사진이 드러난다 (툭 끊기지 않게)
  const leaving = phase === "crew";
  return (
    <>
      {leaving && <CrewScreen fadeIn />}
      <div className={`fixed inset-0 z-[200] overflow-hidden bg-[#121417] flex items-center justify-center select-none ${leaving ? "intro-overlay-out pointer-events-none" : ""}`}>
        <div className="intro-bloom intro-bloom-on" />
        <div className="relative px-8 text-center flex flex-col items-center">
          <img src="/icons/icon-512.png" alt="슈퍼한입 챌린지" className={`intro-icon mb-10 ${leaving ? "intro-icon-away" : "intro-icon-pop"}`} />
          <div className="min-h-[96px] flex items-center justify-center">
          {phase === "line1" && <p key="l1" className="intro-line text-[28px] font-black text-white leading-snug">인생을 바꾸는<br />가장 쉬운 방법</p>}
          {phase === "line2" && <p key="l2" className="intro-line text-[22px] font-bold text-white leading-relaxed">꾸준함이 자존감이 되고,<br />자존감이 인생을 바꾼다</p>}
          </div>
        </div>
      </div>
    </>
  );
}
