// 자랑하기 — 인증 카드 이미지를 만들어 휴대폰 공유창(카카오톡 등)으로 보낸다 (2026-11-20)
// 특정 카톡방에 저절로 올리는 건 카카오가 막아서 불가 → 공유창에서 카카오톡 → 방만 고르면 됨.

export type ProofCard = {
  emoji: string;        // 큰 이모지
  title: string;        // 예: "스무디 인증"
  lines: string[];      // 예: ["레드 단스 · 옐로우 단스", "탄 43g · 단 33g · 지 6g"]
  userName?: string;
  date: string;         // YYYY-MM-DD
  count?: number;       // 이번 회차 안에서 이 항목 몇 번째
  photo?: string;       // 직접 올린 사진(dataURL 또는 주소) → 가운데 크게
  itemLabel?: string;   // 예: "스무디" "기상" "물" "운동" "식단" "이게돼"
  feedback?: string;    // 맨 아래 피드백
  body?: string;        // 사진 대신 글(이게돼)
  time?: string;        // 인증 시각 "오후 8:18"
};

/** 2026-11-20 새 자랑 사진 (4:5, 인스타 그대로 사용 가능)
 *  맨 위: 이름 · 항목 N회째(크게) / 인증 시간
 *  가운데: 직접 올린 사진 크게 (또는 이게돼 글)
 *  맨 아래: 피드백 */
export async function makeProofImage2(card: ProofCard): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const accent = cssVar("--primary", "#b6f24a");
  const bg = cssVar("--background", "#2b2d31");
  const bodyFont = getComputedStyle(document.body).fontFamily || "sans-serif";
  try { await (document as any).fonts?.ready; } catch {}

  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.06)"; roundRect(g, 40, 40, W - 80, H - 80, 44); g.fill();
  g.fillStyle = accent; roundRect(g, 40, 40, W - 80, 12, 6); g.fill();

  // 맨 위: 이름 · 항목 N회째
  g.textAlign = "left";
  g.fillStyle = "#ececea"; g.font = `700 46px ${bodyFont}`;
  g.fillText(clip(g, card.userName || "멤버", 520), 90, 140);
  const nameW = Math.min(520, g.measureText(card.userName || "멤버").width);
  g.fillStyle = accent; g.font = `900 92px ${bodyFont}`;
  const head = `${card.itemLabel ?? card.title} ${card.count ?? ""}${card.count != null ? "회째" : ""}`.trim();
  g.fillText(clip(g, head, W - 180), 90, 250);
  g.fillStyle = "#a6a9ae"; g.font = `500 36px ${bodyFont}`;
  g.fillText(`${card.emoji}  ${fmtDate(card.date)}${card.time ? `  ${card.time}` : ""}`, 90, 312);
  void nameW;

  // 가운데: 사진 또는 글
  const bx = 90, by = 352, bw = W - 180, bh = 780;
  if (card.photo) {
    try {
      const img = await loadImg(card.photo);
      g.save(); roundRect(g, bx, by, bw, bh, 32); g.clip();
      const s = Math.max(bw / img.width, bh / img.height);
      const iw = img.width * s, ih = img.height * s;
      g.drawImage(img, bx + (bw - iw) / 2, by + (bh - ih) / 2, iw, ih);
      g.restore();
    } catch { drawBodyText(g, card.lines.join("\n") || card.title, bx, by, bw, bh, bodyFont); }
  } else {
    g.fillStyle = "rgba(255,255,255,0.05)"; roundRect(g, bx, by, bw, bh, 32); g.fill();
    drawBodyText(g, card.body ?? card.lines.join("\n"), bx + 40, by + 40, bw - 80, bh - 80, bodyFont);
  }

  // 맨 아래: 피드백
  const fb = card.feedback ?? card.lines[0] ?? "";
  if (fb) {
    g.textAlign = "left"; g.fillStyle = "#ececea"; g.font = `600 40px ${bodyFont}`;
    wrap(g, `💬 ${fb}`, W - 180).slice(0, 2).forEach((l, i) => g.fillText(l, 90, 1190 + i * 52));
  }
  g.textAlign = "right"; g.fillStyle = accent; g.font = `500 26px ${bodyFont}`;
  g.fillText("super hannip Challenge", W - 90, H - 62);
  return await new Promise<Blob>((res) => c.toBlob(b => res(b!), "image/png"));
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of Array.from(para)) {
      if (g.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch;
    }
    out.push(line);
  }
  return out;
}
function drawBodyText(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, font: string) {
  let size = 52;
  let lines: string[] = [];
  for (; size >= 30; size -= 4) { g.font = `500 ${size}px ${font}`; lines = wrap(g, text, w); if (lines.length * size * 1.45 <= h) break; }
  g.textAlign = "left"; g.fillStyle = "#ececea";
  lines.slice(0, Math.floor(h / (size * 1.45))).forEach((l, i) => g.fillText(l, x, y + size + i * size * 1.45));
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function fmtDate(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${y}.${m}.${dd} (${w})`;
}

export async function makeProofImage(card: ProofCard): Promise<Blob> {
  const W = 1080, H = 1080;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const accent = cssVar("--primary", "#b6f24a");
  const bodyFont = getComputedStyle(document.body).fontFamily || "sans-serif";
  try { await (document as any).fonts?.ready; } catch {}

  // 배경
  g.fillStyle = "#2b2d31"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#383b41";
  roundRect(g, 60, 60, W - 120, H - 120, 48); g.fill();
  // 위 띠
  g.fillStyle = accent; roundRect(g, 60, 60, W - 120, 14, 7); g.fill();

  g.textAlign = "left";
  g.fillStyle = accent; g.font = `500 34px ${bodyFont}`;
  g.fillText("인생을 바꾸는 가장 쉬운 방법", 120, 150);
  g.fillStyle = "#ececea"; g.font = `700 54px ${bodyFont}`;
  g.fillText("super hannip Challenge", 120, 220);
  g.fillStyle = "#a6a9ae"; g.font = `400 34px ${bodyFont}`;
  g.fillText(`${fmtDate(card.date)}${card.userName ? ` · ${card.userName}` : ""}`, 120, 280);

  // 본문
  g.textAlign = "center";
  g.font = `140px ${bodyFont}`;
  g.fillText(card.emoji, W / 2, 500);
  g.fillStyle = "#ececea"; g.font = `800 76px ${bodyFont}`;
  g.fillText(card.title, W / 2, 620);
  g.fillStyle = "#cfd2d6"; g.font = `500 40px ${bodyFont}`;
  card.lines.slice(0, 3).forEach((l, i) => g.fillText(clip(g, l, W - 240), W / 2, 700 + i * 58));

  if (card.count != null) {
    g.fillStyle = accent; g.font = `800 44px ${bodyFont}`;
    g.fillText(`누적 ${card.count}회`, W / 2, 900);
  }
  g.fillStyle = accent; g.font = `400 40px 'Nanum Brush Script', 'Nanum Pen Script', ${bodyFont}`;
  g.fillText("꾸준함이 자존감이 되고, 자존감이 인생을 바꾼다", W / 2, 975);

  return await new Promise<Blob>((res) => c.toBlob(b => res(b!), "image/png"));
}

function clip(g: CanvasRenderingContext2D, s: string, max: number) {
  if (g.measureText(s).width <= max) return s;
  while (s.length > 1 && g.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** 이미지 만들어 공유창 열기. 안 되는 환경이면 이미지 저장 + 문구 복사. 결과를 문자열로 돌려준다. */
export async function shareProof(card: ProofCard): Promise<"shared" | "cancelled" | "blocked" | "downloaded" | "preview"> {
  const text = card.itemLabel
    ? `${card.emoji} ${card.userName ?? ""} · ${card.itemLabel} ${card.count ?? ""}회째${card.feedback ? `\n${card.feedback}` : ""}\n#super_hannip_challenge`
    : `${card.emoji} ${card.title} 완료!${card.lines[0] ? `\n${card.lines[0]}` : ""}\n#super_hannip_challenge`;
  const blob = card.itemLabel ? await makeProofImage2(card) : await makeProofImage(card);
  const file = new File([blob], `hannip_${card.date}.png`, { type: "image/png" });
  const nav = navigator as any;
  if (!isKakaoInApp() && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e: any) {
      // 저장하느라 시간이 걸려 '누른 직후'가 아니면 브라우저가 막는다 → 버튼 한 번 더 누르게
      return e?.name === "NotAllowedError" ? "blocked" : "cancelled";
    }
  }
  // 카톡 안 브라우저: 공유·다운로드가 막혀 있음 → 사진을 화면에 띄워 '길게 눌러 저장'하게
  if (isKakaoInApp()) {
    try { await navigator.clipboard.writeText(text); } catch {}
    const dataUrl = await blobToDataUrl(blob);
    window.dispatchEvent(new CustomEvent("hannip-proof-preview", { detail: { dataUrl, text } }));
    return "preview";
  }
  // 공유 불가(PC 등): 이미지 저장 + 문구 복사
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  try { await navigator.clipboard.writeText(text); } catch {}
  return "downloaded";
}

export function isKakaoInApp(): boolean {
  return typeof navigator !== "undefined" && /KAKAOTALK/i.test(navigator.userAgent);
}

/** 카톡 안 브라우저에서 휴대폰 기본 브라우저(크롬·삼성인터넷)로 다시 열기 */
export function openInExternalBrowser() {
  const url = location.href;
  if (/Android/i.test(navigator.userAgent)) {
    // 안드로이드: 크롬을 콕 집어서 연다. 크롬이 없으면 기본 브라우저로.
    const noScheme = url.replace(/^https?:\/\//, "");
    location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return;
  }
  // 아이폰 등: 카톡이 기본 브라우저(사파리)로 열어 준다
  location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}