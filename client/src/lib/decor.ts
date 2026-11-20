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
  { id: "sunflower", name: "해바라기", family: "'Sunflower'" },
  { id: "gaegu", name: "개구쟁이", family: "'Gaegu'" },
  { id: "pen", name: "손글씨", family: "'Nanum Pen Script'" },
  { id: "myeongjo", name: "명조", family: "'Nanum Myeongjo'" },
  { id: "blackhan", name: "굵은 제목", family: "'Black Han Sans'" },
];

export const PATTERNS = [
  { id: "none", name: "없음", css: "none" },
  { id: "dots", name: "도트", css: "radial-gradient(rgba(255,255,255,0.07) 1.2px, transparent 1.3px) 0 0 / 18px 18px" },
  { id: "grid", name: "모눈", css: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0 / 24px 24px" },
  { id: "stripe", name: "사선", css: "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 10px, transparent 10px 20px)" },
  { id: "glow", name: "빛", css: "radial-gradient(circle at 15% 0%, var(--primary-glow) 0, transparent 45%), radial-gradient(circle at 100% 30%, var(--primary-glow) 0, transparent 40%)" },
];

export type Decor = { color: string; font: string; pattern: string };
const KEY = "hannip_decor_v1";
export const DEFAULT_DECOR: Decor = { color: "lime", font: "basic", pattern: "none" };

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
  const root = document.documentElement.style;
  for (const v of ["--primary", "--accent", "--ring", "--chart-1", "--sidebar-primary", "--sidebar-ring"]) root.setProperty(v, color.hex);
  root.setProperty("--primary-glow", hexToRgba(color.hex, 0.12));
  let style = document.getElementById("hannip-decor") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "hannip-decor";
    document.head.appendChild(style);
  }
  const fontCss = font.family ? `body, body * { font-family: ${font.family}, 'Pretendard', 'Noto Sans KR', sans-serif !important; }` : "";
  const bgCss = pattern.css !== "none" ? `body { background: ${pattern.css}, var(--background) !important; background-attachment: fixed !important; }` : "";
  style.textContent = `${fontCss}\n${bgCss}`;
}

export function saveDecor(d: Decor) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
  applyDecor(d);
}
