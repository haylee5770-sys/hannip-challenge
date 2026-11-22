// 첫 화면 인트로 (2026-11-22, 해이 요청)
// 링크를 열면 바로: 보라·초록 빛이 번지고 → 가운데 "인생을 바꾸는 가장 쉬운 방법" → "꾸준함이 자존감이 되고…"
// → 연회색으로 바뀌며 크루 사진이 나타나고 → 그 화면 아래에 버튼(크롬으로 열기 / 구글 입장)
// 음악: 새소리 + 피아노 (직접 만든 소리, 저작권 없음). 휴대폰은 화면을 한 번 누르기 전엔 소리를 막아서, 누르는 순간부터 들린다.
// 카톡에서 [크롬으로 열기]로 넘어온 경우(주소에 from=kakao)는 인트로를 다시 보여 주지 않는다.
import { useEffect, useRef, useState } from "react";

let audioStarted = false;
let introAc: AudioContext | null = null;
function playIntroMusic() {
  if (audioStarted) return; audioStarted = true;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac: AudioContext = new AC(); introAc = ac;
    const t0 = ac.currentTime + 0.05;
    const out = ac.createGain(); out.gain.value = 0.0001; out.connect(ac.destination);
    out.gain.exponentialRampToValueAtTime(0.9, t0 + 0.6);
    out.gain.setValueAtTime(0.9, t0 + 8.5);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 11);
    // 잔향(홀 울림)
    const rev = ac.createConvolver();
    const len = ac.sampleRate * 2.8, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.45; rev.connect(wet); wet.connect(out);
    const dry = ac.createGain(); dry.gain.value = 0.7; dry.connect(out);

    // 피아노 한 음: 배음 몇 개 + 빠른 시작, 천천히 사라짐
    const piano = (freq: number, at: number, vel = 0.22, dur = 3.2) => {
      const g = ac.createGain(); g.gain.value = 0.0001; g.connect(dry); g.connect(rev);
      g.gain.exponentialRampToValueAtTime(vel, at + 0.012);
      g.gain.exponentialRampToValueAtTime(vel * 0.35, at + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      [[1, 1], [2, 0.42], [3, 0.18], [4, 0.09], [5, 0.05]].forEach(([h, a]) => {
        const o = ac.createOscillator(); const og = ac.createGain();
        o.type = "sine"; o.frequency.value = freq * h; o.detune.value = (Math.random() - 0.5) * 4; og.gain.value = a;
        o.connect(og); og.connect(g); o.start(at); o.stop(at + dur + 0.1);
      });
    };
    const N: Record<string, number> = { G3: 196, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C4: 261.63, A3: 220, F4: 349.23 };
    // 잔잔하고 맑은 선율 (G장조)
    const mel: Array<[string, number, number?]> = [["B4", 0.4], ["D5", 0.9], ["G5", 1.4, 0.2], ["E5", 2.3], ["D5", 2.8], ["B4", 3.3], ["A4", 4.2], ["B4", 4.7], ["D5", 5.2, 0.2], ["G5", 6.1], ["A5", 6.6], ["B5", 7.1, 0.18], ["G5", 8.2, 0.16]];
    mel.forEach(([n, at, v]) => piano(N[n], t0 + at, v ?? 0.18, 3.4));
    // 아래 화음
    ([["G3", 0.4], ["D4", 0.45], ["C4", 2.3], ["E4", 2.35], ["A3", 4.2], ["E4", 4.25], ["G3", 6.1], ["D4", 6.15], ["G4", 8.2]] as Array<[string, number]>)
      .forEach(([n, at]) => piano(N[n], t0 + at, 0.1, 4));

    // 새소리: 짧게 위로 미끄러지는 지저귐 여러 번, 왼쪽·오른쪽에서
    const chirp = (at: number, base: number, pan: number) => {
      const p = (ac as any).createStereoPanner ? ac.createStereoPanner() : null;
      const g = ac.createGain(); g.gain.value = 0.0001;
      if (p) { p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
      const o = ac.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(base, at);
      o.frequency.exponentialRampToValueAtTime(base * 1.6, at + 0.06);
      o.frequency.exponentialRampToValueAtTime(base * 1.15, at + 0.11);
      g.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
      o.connect(g); o.start(at); o.stop(at + 0.15);
    };
    const song = (at: number, base: number, pan: number, n: number) => { for (let i = 0; i < n; i++) chirp(at + i * (0.13 + Math.random() * 0.05), base * (1 + (Math.random() - 0.5) * 0.12), pan); };
    [[0.2, 3200, -0.6, 4], [1.6, 3800, 0.5, 3], [3.0, 2900, -0.3, 5], [4.6, 4100, 0.7, 3], [6.0, 3400, -0.7, 4], [7.6, 3700, 0.3, 4], [9.0, 3100, -0.4, 3]]
      .forEach(([at, b, p, n]) => song(t0 + at, b, p, n));
    if (ac.state === "suspended") ac.resume();
  } catch { /* 소리 없이 진행 */ }
}

type Phase = "bloom" | "line1" | "line2" | "crew" | "done";
const fromKakao = () => { try { return new URLSearchParams(location.search).get("from") === "kakao"; } catch { return false; } };

/** 연회색 바탕 + 위쪽 크루 사진. 아래에 버튼 등이 들어간다 */
export function CrewScreen({ children, fadeIn }: { children?: React.ReactNode; fadeIn?: boolean }) {
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "linear-gradient(180deg,#dcdcdc 0%,#d4d4d4 45%,#c9c9c9 100%)" }}>
      <div className="min-h-full flex flex-col items-center">
        <img src="/intro/crew.jpg" alt="슈퍼한입 챌린지 크루" className={`w-full max-w-[640px] mt-[7vh] ${fadeIn ? "intro-crew-in" : ""}`}
          style={{ WebkitMaskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 86%,transparent 100%)", maskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 86%,transparent 100%)" }} />
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
    const tap = () => { if (introAc && introAc.state === "suspended") introAc.resume(); window.removeEventListener("pointerdown", tap); };
    window.addEventListener("pointerdown", tap);
    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    at(1300, () => setPhase("line1"));
    at(3900, () => setPhase("line2"));
    at(6800, () => setPhase("crew"));
    at(8000, () => { try { sessionStorage.setItem("hannipIntro", "1"); } catch { /* */ } setPhase("done"); });
    return () => { timers.current.forEach(clearTimeout); window.removeEventListener("pointerdown", tap); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (phase === "done") return <>{children}</>;
  if (phase === "crew") return <CrewScreen fadeIn />;
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#121417] flex items-center justify-center select-none">
      <div className="intro-bloom intro-bloom-on" />
      <div className="relative px-8 text-center">
        {phase === "line1" && <p key="l1" className="intro-line text-[28px] font-black text-white leading-snug">인생을 바꾸는<br />가장 쉬운 방법</p>}
        {phase === "line2" && <p key="l2" className="intro-line text-[22px] font-bold text-white leading-relaxed">꾸준함이 자존감이 되고,<br />자존감이 인생을 바꾼다</p>}
      </div>
    </div>
  );
}
