// 꾸미기 — 각자 색·글씨체·배경 무늬를 골라 '내 앱'처럼 (2026-11-20)
// 고른 값은 그 휴대폰(브라우저)에만 저장된다.

export const COLORS = [
  { id: "lime", name: "라임", hex: "#b6f24a" },
  { id: "naver", name: "초록", hex: "#03c75a" },
  { id: "mint", name: "민트", hex: "#5eead4" },
  { id: "sky", name: "하늘", hex: "#7cc4ff" },
  { id: "lavender", name: "라벤더", hex: "#b9a6ff" },
  { id: "pink", name: "핑크", hex: "#ff8fc7" },
  { id: "coral", name: "코랄", hex: "#ff8a7a" },
  { id: "sun", name: "햇살", hex: "#ffd84d" },
  { id: "peach", name: "피치", hex: "#ffb26b" },
  { id: "cream", name: "크림", hex: "#f3ead3" },
];

export const FONTS = [
  { id: "basic", name: "기본", family: "" },
  { id: "gowun", name: "고운돋움", family: "'Gowun Dodum'" },
  { id: "gowunbatang", name: "고운바탕", family: "'Gowun Batang'" },
  { id: "jua", name: "주아", family: "'Jua'" },
  { id: "dohyeon", name: "도현", family: "'Do Hyeon'" },
  { id: "myeongjo", name: "명조", family: "'Nanum Myeongjo'" },
  { id: "plex", name: "단정체", family: "'IBM Plex Sans KR'" },
  { id: "hahmlet", name: "함렛", family: "'Hahmlet'" },
];

export const PATTERNS = [
  { id: "none", name: "없음", css: "none" },
  { id: "dots", name: "도트", css: "radial-gradient(rgba(255,255,255,0.13) 1.4px, transparent 1.3px) 0 0 / 18px 18px" },
  { id: "grid", name: "모눈", css: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 24px 24px" },
  { id: "stripe", name: "사선", css: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 10px, transparent 10px 20px)" },
  { id: "glow", name: "빛", css: "radial-gradient(circle at 15% 0%, var(--primary-glow) 0, transparent 45%), radial-gradient(circle at 100% 30%, var(--primary-glow) 0, transparent 40%)" },
];

// 배경 색 (어두운 계열만 — 글씨가 밝은색이라)
export const BACKGROUNDS = [
  { id: "charcoal", name: "차콜", hex: "#2b2d31" },
  { id: "black", name: "블랙", hex: "#16171a" },
  { id: "slate", name: "슬레이트", hex: "#26303a" },
  { id: "navy", name: "네이비", hex: "#1b2340" },
  { id: "teal", name: "딥틸", hex: "#123334" },
  { id: "forest", name: "숲", hex: "#1c2e22" },
  { id: "olive", name: "올리브", hex: "#2c2f1f" },
  { id: "brown", name: "브라운", hex: "#33281f" },
  { id: "burgundy", name: "버건디", hex: "#3a1d24" },
  { id: "plum", name: "자두", hex: "#2e2238" },
];

export type Decor = { color: string; bg: string; font: string; pattern: string; quote?: boolean; coach?: boolean; fortune?: boolean; birthDate?: string };
const KEY = "hannip_decor_v1";
export const DEFAULT_DECOR: Decor = { color: "lime", bg: "charcoal", font: "basic", pattern: "none", quote: true, coach: true };

export function loadDecor(): Decor {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") return { ...DEFAULT_DECOR, ...v };
  } catch {}
  return DEFAULT_DECOR;
}

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function applyDecor(d: Decor) {
  if (typeof document === "undefined") return;
  const color = COLORS.find(c => c.id === d.color) ?? COLORS[0];
  const font = FONTS.find(f => f.id === d.font) ?? FONTS[0];
  const pattern = PATTERNS.find(p => p.id === d.pattern) ?? PATTERNS[0];
  const bg = BACKGROUNDS.find(b => b.id === d.bg) ?? BACKGROUNDS[0];
  const root = document.documentElement.style;
  for (const v of ["--primary", "--accent", "--ring", "--chart-1", "--sidebar-primary", "--sidebar-ring"]) root.setProperty(v, color.hex);
  root.setProperty("--primary-glow", hexToRgba(color.hex, 0.12));
  // 배경색과, 그보다 살짝 밝은 칸 색
  root.setProperty("--background", bg.hex);
  root.setProperty("--card", `color-mix(in srgb, ${bg.hex} 88%, white)`);
  root.setProperty("--popover", `color-mix(in srgb, ${bg.hex} 88%, white)`);
  root.setProperty("--secondary", `color-mix(in srgb, ${bg.hex} 80%, white)`);
  root.setProperty("--muted", `color-mix(in srgb, ${bg.hex} 80%, white)`);
  root.setProperty("--sidebar", `color-mix(in srgb, ${bg.hex} 94%, black)`);
  // 테두리·선은 고른 글씨 색이 아주 연하게 비치게
  root.setProperty("--border", `color-mix(in srgb, ${color.hex} 22%, color-mix(in srgb, ${bg.hex} 75%, white))`);
  root.setProperty("--input", `color-mix(in srgb, ${color.hex} 22%, color-mix(in srgb, ${bg.hex} 75%, white))`);
  let style = document.getElementById("hannip-decor") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "hannip-decor";
    document.head.appendChild(style);
  }
  const fontCss = font.family ? `body, body *:not([data-keep-font]):not([data-keep-font] *) { font-family: ${font.family}, 'Pretendard', 'Noto Sans KR', sans-serif !important; }` : "";
  const bgCss = pattern.css !== "none" ? `body, .paper-grain { background: ${pattern.css}, var(--background) !important; background-attachment: fixed !important; }` : "";
  style.textContent = `${fontCss}\n${bgCss}`;
}

export function saveDecor(d: Decor) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
  applyDecor(d);
}
