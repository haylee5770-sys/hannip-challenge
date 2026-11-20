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
  avatar?: string | null; // 카톡방과 같은 프로필 사진 (이름 앞 둥근 네모)
};

/** 카톡 프로필처럼 둥근 네모 사진 */
async function drawAvatar(g: CanvasRenderingContext2D, src: string | null | undefined, x: number, y: number, s: number, fallbackName: string, accent: string) {
  g.save(); roundRect(g, x, y, s, s, s * 0.36); g.clip();
  let ok = false;
  if (src) { try { const img = await loadImg(src); const k = Math.max(s / img.width, s / img.height); g.drawImage(img, x + (s - img.width * k) / 2, y + (s - img.height * k) / 2, img.width * k, img.height * k); ok = true; } catch {} }
  if (!ok) { g.fillStyle = accent; g.fillRect(x, y, s, s); g.fillStyle = "#1d1e21"; g.textAlign = "center"; g.font = `800 ${Math.round(s * 0.45)}px sans-serif`; g.fillText(Array.from(fallbackName)[0] ?? "?", x + s / 2, y + s * 0.64); }
  g.restore();
}

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

  // 맨 위 한 줄 (2026-11-20 시안2): 이름(흰색) + 항목(포인트색) 같은 글씨·크기·두께, 오른쪽 동그라미 안에 인증 번호
  const name = card.userName || "멤버";
  const item = card.itemLabel ?? card.title;
  const hasCount = card.count != null;
  // 2026-11-21: 이름 앞에 카톡과 같은 프로필 사진(둥근 네모)
  const AV = 120, avX = 90, textX = avX + AV + 26;
  await drawAvatar(g, card.avatar, avX, 108, AV, name, accent);
  const maxHeadW = (hasCount ? W - 90 - 200 : W - 90) - textX;
  let size = 92;
  for (; size > 40; size -= 4) { g.font = `900 ${size}px ${bodyFont}`; if (g.measureText(`${name} ${item}`).width <= maxHeadW) break; }
  g.textAlign = "left"; g.font = `900 ${size}px ${bodyFont}`;
  g.fillStyle = "#ffffff"; g.fillText(name, textX, 200);
  const nw = g.measureText(name + " ").width;
  g.fillStyle = accent; g.fillText(item, textX + nw, 200);
  if (hasCount) {
    const cx = W - 170, cy = 168, r = 80;
    g.save(); g.shadowColor = accent; g.shadowBlur = 30; g.strokeStyle = accent; g.lineWidth = 8;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); g.restore();
    g.save(); g.globalAlpha = 0.12; g.fillStyle = accent; g.beginPath(); g.arc(cx, cy, r - 4, 0, Math.PI * 2); g.fill(); g.restore();
    g.textAlign = "center"; g.fillStyle = accent;
    const cs = String(card.count);
    g.font = `900 ${cs.length >= 3 ? 60 : 84}px ${bodyFont}`; g.fillText(cs, cx, cy + 20);
    g.font = `700 22px ${bodyFont}`; g.fillStyle = "#cfd2d6"; g.fillText("인증", cx, cy + 56);
  }
  // 시계 + 날짜·시간 (아래 피드백 글씨와 같은 크기·두께)
  g.textAlign = "left";
  g.save(); g.strokeStyle = "#ececea"; g.lineWidth = 5; g.lineCap = "round";
  g.beginPath(); g.arc(114, 284, 22, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(114, 284); g.lineTo(114, 272); g.moveTo(114, 284); g.lineTo(124, 287); g.stroke(); g.restore();
  g.fillStyle = "#ececea"; g.font = `600 40px ${bodyFont}`;
  g.fillText(`${fmtDate(card.date)}${card.time ? `  ${card.time}` : ""}`, 154, 298);

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
  g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.22)"; g.font = `500 26px ${bodyFont}`;
  g.fillText("super hannip Challenge", W / 2, H - 62);
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

/** 이게돼 (2026-11-21): 카톡 대화 화면처럼. 4:5(캐러셀 비율) 그대로, 글이 넘치면 2장·3장으로 나눔 */
export async function makeItgeImages(card: ProofCard): Promise<Blob[]> {
  const W = 1080, H = 1350;
  const bodyFont = getComputedStyle(document.body).fontFamily || "sans-serif";
  try { await (document as any).fonts?.ready; } catch {}
  const KAKAO_BG = "#b2c7d9", INK = "#1f2328", GREEN = "#3f7d16";
  const name = card.userName || "멤버";
  const AV = 120, avX = 60, bubX = avX + AV + 24, bubW = W - bubX - 70;
  const FS = 46, LH = 70, padX = 40, padY = 36;
  // 줄 나누기
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = `500 ${FS}px ${bodyFont}`;
  const lines = wrap(meas, (card.body ?? "").trim(), bubW - padX * 2);
  const firstTop = 300, otherTop = 300, bottomLimit = H - 120;
  const perPage = Math.max(1, Math.floor((bottomLimit - firstTop - padY * 2) / LH));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([""]);
  const out: Blob[] = [];
  for (let p = 0; p < pages.length; p++) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = KAKAO_BG; g.fillRect(0, 0, W, H);
    // 프로필 + 이름 · 이게돼 (같은 글씨·크기·두께)
    await drawAvatar(g, card.avatar, avX, 80, AV, name, GREEN);
    const textX = bubX;
    const hasCount = card.count != null;
    let size = 64;
    for (; size > 36; size -= 4) { g.font = `800 ${size}px ${bodyFont}`; if (g.measureText(`${name} 이게돼`).width <= W - textX - (hasCount ? 200 : 70)) break; }
    g.textAlign = "left"; g.font = `800 ${size}px ${bodyFont}`;
    g.fillStyle = INK; g.fillText(name, textX, 150);
    const nw = g.measureText(name + " ").width;
    g.fillStyle = GREEN; g.fillText("이게돼", textX + nw, 150);
    // 날짜·시간
    g.save(); g.strokeStyle = "#4b5560"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.arc(textX + 18, 204, 17, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(textX + 18, 204); g.lineTo(textX + 18, 194); g.moveTo(textX + 18, 204); g.lineTo(textX + 26, 207); g.stroke(); g.restore();
    g.fillStyle = "#4b5560"; g.font = `600 36px ${bodyFont}`;
    g.fillText(`${fmtDate(card.date)}${card.time ? `  ${card.time}` : ""}${pages.length > 1 ? `   (${p + 1}/${pages.length})` : ""}`, textX + 48, 217);
    // 오른쪽 동그라미: 이게돼 번호
    if (hasCount) {
      const cx = W - 130, cy = 140, r = 64;
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = GREEN; g.lineWidth = 6; g.stroke();
      g.textAlign = "center"; g.fillStyle = GREEN; g.font = `900 64px ${bodyFont}`; g.fillText(String(card.count), cx, cy + 16);
      g.font = `700 20px ${bodyFont}`; g.fillStyle = "#4b5560"; g.fillText("인증", cx, cy + 44);
    }
    // 말풍선 (카톡처럼 흰색 + 왼쪽 꼬리)
    const top = p === 0 ? firstTop : otherTop;
    const bh = pages[p].length * LH + padY * 2;
    g.fillStyle = "#ffffff";
    roundRect(g, bubX, top, bubW, bh, 26); g.fill();
    if (p === 0) { g.beginPath(); g.moveTo(bubX + 2, top + 22); g.lineTo(bubX - 22, top + 12); g.lineTo(bubX + 2, top + 52); g.closePath(); g.fill(); }
    g.textAlign = "left"; g.fillStyle = INK; g.font = `500 ${FS}px ${bodyFont}`;
    pages[p].forEach((l, i) => g.fillText(l, bubX + padX, top + padY + FS + i * LH - 6));
    if (p < pages.length - 1) { g.textAlign = "right"; g.fillStyle = "#4b5560"; g.font = `600 30px ${bodyFont}`; g.fillText("다음 장에 계속 →", W - 70, H - 80); }
    g.textAlign = "center"; g.fillStyle = "rgba(31,35,40,0.28)"; g.font = `500 26px ${bodyFont}`;
    g.fillText("super hannip Challenge", W / 2, H - 40);
    out.push(await new Promise<Blob>((res) => c.toBlob(b => res(b!), "image/png")));
  }
  return out;
}

/** 이미지 만들어 공유창 열기. 안 되는 환경이면 이미지 저장 + 문구 복사. 결과를 문자열로 돌려준다. */
export async function shareProof(card: ProofCard): Promise<"shared" | "cancelled" | "blocked" | "downloaded" | "preview"> {
  const text = card.itemLabel
    ? `${card.emoji} ${card.userName ?? ""} · ${card.itemLabel}${card.count != null ? ` 누적 ${card.count}` : ""}${card.itemLabel !== "이게돼" && card.feedback ? `\n${card.feedback}` : ""}\n#super_hannip_challenge`
    : `${card.emoji} ${card.title} 완료!${card.lines[0] ? `\n${card.lines[0]}` : ""}\n#super_hannip_challenge`;
  const blobs = card.itemLabel === "이게돼" && card.body ? await makeItgeImages(card)
    : [card.itemLabel ? await makeProofImage2(card) : await makeProofImage(card)];
  const files = blobs.map((b, i) => new File([b], `hannip_${card.date}${blobs.length > 1 ? `_${i + 1}` : ""}.png`, { type: "image/png" }));
  const nav = navigator as any;
  if (!isKakaoInApp() && nav.canShare && nav.canShare({ files })) {
    try {
      await nav.share({ files, text });
      return "shared";
    } catch (e: any) {
      // 저장하느라 시간이 걸려 '누른 직후'가 아니면 브라우저가 막는다 → 버튼 한 번 더 누르게
      return e?.name === "NotAllowedError" ? "blocked" : "cancelled";
    }
  }
  // 카톡 안 브라우저: 공유·다운로드가 막혀 있음 → 사진을 화면에 띄워 '길게 눌러 저장'하게
  if (isKakaoInApp()) {
    try { await navigator.clipboard.writeText(text); } catch {}
    const dataUrls = await Promise.all(blobs.map(blobToDataUrl));
    window.dispatchEvent(new CustomEvent("hannip-proof-preview", { detail: { dataUrls, text } }));
    return "preview";
  }
  // 공유 불가(PC 등): 이미지 저장 + 문구 복사
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
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