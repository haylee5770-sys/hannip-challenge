// 첫 화면 인트로 (2026-11-22, 해이 요청)
// 앱 아이콘이 나타나고 → 보라·초록 빛이 화면 가득 번지고 → "인생을 바꾸는 가장 쉬운 방법"이 스르륵 → 사라지며
// "꾸준함이 자존감이 되고, 자존감이 인생을 바꾼다" → 사라지면 다음 화면.
// 휴대폰은 사람이 화면을 누르기 전에는 소리를 못 내게 막혀 있어서, 처음에 아이콘을 눌러 시작한다 (누르면 음악과 함께)
import { useEffect, useRef, useState } from "react";

/** 저작권 걱정 없는 직접 만든 소리: 잔잔한 화음 위에 맑은 종소리 (약 7초) */
function playIntroMusic() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const master = ac.createGain(); master.gain.value = 0.0001; master.connect(ac.destination);
    const t0 = ac.currentTime;
    master.gain.exponentialRampToValueAtTime(0.5, t0 + 0.8);
    master.gain.setValueAtTime(0.5, t0 + 5.5);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 8);
    // 잔잔한 화음 (C장조 add9)
    [261.63, 329.63, 392.0, 587.33].forEach((f, i) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.6 + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.5);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 8);
    });
    // 맑은 종소리 아르페지오
    [783.99, 987.77, 1174.66, 1567.98, 1318.51, 1567.98, 2093.0].forEach((f, i) => {
      const t = t0 + 0.4 + i * 0.55;
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = "triangle"; o.frequency.value = f; g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 2);
    });
  } catch { /* 소리 없이 진행 */ }
}

type Phase = "tap" | "grow" | "line1" | "line2" | "out";

export default function IntroSplash({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(() => { try { return sessionStorage.getItem("hannipIntro") === "1"; } catch { return false; } });
  const [phase, setPhase] = useState<Phase>("tap");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (done) return <>{children}</>;

  const finish = () => { try { sessionStorage.setItem("hannipIntro", "1"); } catch { /* */ } setDone(true); };
  const start = () => {
    if (phase !== "tap") return;
    playIntroMusic();
    setPhase("grow");
    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    at(1400, () => setPhase("line1"));
    at(3900, () => setPhase("line2"));
    at(6900, () => setPhase("out"));
    at(7800, finish);
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#121417] flex items-center justify-center select-none" onClick={start}>
      {/* 화면 가득 번지는 보라·초록 빛 */}
      <div className={`intro-bloom ${phase !== "tap" ? "intro-bloom-on" : ""}`} />
      {/* 앱 아이콘 */}
      <div className={`relative flex flex-col items-center transition-all duration-700 ${phase === "line1" || phase === "line2" || phase === "out" ? "intro-icon-up" : ""}`}>
        <img src="/icons/icon-512.png" alt="슈퍼한입 챌린지" className={`intro-icon ${phase === "tap" ? "intro-icon-pulse" : "intro-icon-pop"}`} />
        {phase === "tap" && <div className="mt-6 text-sm text-white/70 season-fade-in" style={{ animationDelay: ".6s" }}>아이콘을 눌러 시작하기 ♪</div>}
      </div>
      {/* 문구 */}
      <div className="absolute inset-x-0 bottom-[22%] px-8 text-center pointer-events-none">
        {phase === "line1" && <p key="l1" className="intro-line text-2xl font-black text-white leading-snug">인생을 바꾸는<br />가장 쉬운 방법</p>}
        {phase === "line2" && <p key="l2" className="intro-line text-xl font-bold text-white leading-relaxed">꾸준함이 자존감이 되고,<br />자존감이 인생을 바꾼다</p>}
      </div>
      {phase === "out" && <div className="absolute inset-0 bg-background intro-fadeout" />}
      {phase !== "tap" && phase !== "out" && (
        <button type="button" onClick={e => { e.stopPropagation(); finish(); }} className="absolute bottom-6 right-6 text-xs text-white/50">건너뛰기</button>
      )}
    </div>
  );
}
