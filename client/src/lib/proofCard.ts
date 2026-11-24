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
  stamp?: string;       // 이게돼 카드의 '2026-11-24 13:33' (없으면 지금 시각)
  time?: string;        // 인증 시각 "오후 8:18"
  avatar?: string | null; // 카톡방과 같은 프로필 사진 (이름 앞 둥근 네모)
  chatLines?: string[];   // 이게돼: 가운데 칸에 카톡 말풍선으로 넣을 줄들 (한 장 분량)
  pageInfo?: { idx: number; total: number };
  shareSections?: { label: string; value: string }[];  // 카톡 글의 '● 제목 : 내용' 칸들. 있으면 feedback 대신 씀
};

/** 카톡 프로필처럼 둥근 네모 사진 */
export async function drawAvatar(g: CanvasRenderingContext2D, src: string | null | undefined, x: number, y: number, s: number, fallbackName: string, accent: string) {
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

  // 2026-11-25 해이 확정(A안): 바깥 테두리·위쪽 바 없이 카드 전체를 한 판으로, 왼쪽 위에서 포인트색 빛이 은은하게
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(0, 0, W, H);
  const glowA = (a: number) => /^#[0-9a-f]{6}$/i.test(accent) ? `${accent}${Math.round(a * 255).toString(16).padStart(2, "0")}` : `rgba(185,166,255,${a})`;
  const gl1 = g.createRadialGradient(W * 0.18, -H * 0.12, 0, W * 0.18, -H * 0.12, W * 0.75);
  gl1.addColorStop(0, glowA(0.55)); gl1.addColorStop(1, glowA(0));
  g.fillStyle = gl1; g.fillRect(0, 0, W, 420);
  const gl2 = g.createRadialGradient(W, -H * 0.08, 0, W, -H * 0.08, W * 0.5);
  gl2.addColorStop(0, glowA(0.22)); gl2.addColorStop(1, glowA(0));
  g.fillStyle = gl2; g.fillRect(0, 0, W, 420);

  // 맨 위 한 줄 (2026-11-20 시안2): 이름(흰색) + 항목(포인트색) 같은 글씨·크기·두께, 오른쪽 동그라미 안에 인증 번호
  const name = card.userName || "멤버";
  const item = card.itemLabel ?? card.title;
  const hasCount = card.count != null;
  // 2026-11-21: 이름 앞에 카톡과 같은 프로필 사진(둥근 네모)
  const AV = 120, avX = 90, textX = avX + AV + 26;
  await drawAvatar(g, card.avatar, avX, 60, AV, name, accent);
  // 2026-11-24 해이: 누적 동그라미를 키워서 가운데 쪽으로 넓어졌으므로 제목 자리를 그만큼 비움
  const maxHeadW = (hasCount ? W - 310 : W - 90) - textX;
  let size = 92;
  for (; size > 40; size -= 4) { g.font = `900 ${size}px ${bodyFont}`; if (g.measureText(`${name} ${item}`).width <= maxHeadW) break; }
  g.textAlign = "left"; g.font = `900 ${size}px ${bodyFont}`;
  g.fillStyle = "#ffffff"; g.fillText(name, textX, 152);
  const nw = g.measureText(name + " ").width;
  g.fillStyle = accent; g.fillText(item, textX + nw, 152);
  if (hasCount) {
    // 2026-11-24 해이: 동그라미 약 1.4배 크게, 가운데·아래쪽으로 넓어지게 (반지름 80 → 112)
    // 2026-11-24 해이: 위에 붙어 보여서 윗부분(0~사진 시작 300) 위아래 한가운데(150)로
    const cx = W - 172, cy = 150, r = 112;
    // 2026-11-22 (해이): 네온·번짐 없이 깔끔한 꽉 찬 동그라미
    // 2026-11-24 해이: 앱의 '누적 1회' 유리알 동그라미와 똑같이 (한 톤 진한 같은 색 + 흰 테두리 + 위쪽 반짝임, 글씨 '누적' / 'N회')
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath();
    g.fillStyle = accent; g.fill();
    const dk = g.createLinearGradient(0, cy - r, 0, cy + r); dk.addColorStop(0, "rgba(0,0,0,0.45)"); dk.addColorStop(1, "rgba(0,0,0,0.70)");
    g.fillStyle = dk; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = "rgba(255,255,255,0.28)"; g.stroke();
    g.clip();
    const hl = g.createLinearGradient(0, cy - r * 0.92, 0, cy - r * 0.4); hl.addColorStop(0, "rgba(255,255,255,0.4)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hl; g.beginPath(); g.ellipse(cx, cy - r * 0.66, r * 0.56, r * 0.26, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,0.75)"; g.font = `700 33px ${bodyFont}`; g.fillText("누적", cx, cy - 30);
    const cs = `${card.count}회`;
    g.fillStyle = "#f4fff7"; g.font = `900 ${cs.length >= 4 ? 64 : 80}px ${bodyFont}`; g.fillText(cs, cx, cy + 54);
  }
  // 시계 + 날짜·시간 (아래 피드백 글씨와 같은 크기·두께)
  g.textAlign = "left";
  g.save(); g.strokeStyle = "#ececea"; g.lineWidth = 5; g.lineCap = "round";
  g.beginPath(); g.arc(114, 236, 22, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(114, 236); g.lineTo(114, 224); g.moveTo(114, 236); g.lineTo(124, 239); g.stroke(); g.restore();
  g.fillStyle = "#ececea"; g.font = `600 40px ${bodyFont}`;
  g.fillText(`${fmtDate(card.date)}${card.time ? `  ${card.time}` : ""}`, 154, 250);

  // 가운데: 사진 또는 글 (이게돼는 카톡 대화 화면처럼)
  // 사진은 시간 아래부터 바닥까지, 양옆 끝까지 꽉 (글 카드는 예전처럼 안쪽 상자)
  const photoTop = 300;
  const bx = 70, by = photoTop, bw = W - 140, bh = 820;
  let photoDone = false;
  if (card.chatLines) {
    // 연회색 바탕 + 프로필·이름 + 흰 말풍선 (2026-11-21)
    g.save(); roundRect(g, bx, by, bw, bh, 32); g.clip();
    g.fillStyle = "#dfe3e8"; g.fillRect(bx, by, bw, bh);
    const av = 92, ax = bx + 30, ay = by + 34;
    const firstPage = !card.pageInfo || card.pageInfo.idx === 0;
    if (firstPage) {
      await drawAvatar(g, card.avatar, ax, ay, av, name, accent);
      g.textAlign = "left"; g.fillStyle = "#3b4048"; g.font = `600 34px ${bodyFont}`;
      g.fillText(name, ax + av + 22, ay + 36);
    }
    const bubX = ax + av + 22, bubY = firstPage ? ay + 56 : by + 40, bubW = bw - (bubX - bx) - 30;
    const FS = 40, LH = 60, padX = 32, padY = 28;
    const bh2 = card.chatLines.length * LH + padY * 2;
    g.fillStyle = "#ffffff"; roundRect(g, bubX, bubY, bubW, bh2, 28); g.fill();
    if (firstPage) { g.beginPath(); g.moveTo(bubX + 2, bubY + 18); g.lineTo(bubX - 18, bubY + 8); g.lineTo(bubX + 2, bubY + 44); g.closePath(); g.fill(); }
    g.fillStyle = "#1f2328"; g.font = `500 ${FS}px ${bodyFont}`; g.textAlign = "left";
    card.chatLines.forEach((l, i) => g.fillText(l, bubX + padX, bubY + padY + FS + i * LH - 6));
    if (card.pageInfo && card.pageInfo.total > 1) {
      g.textAlign = "right"; g.fillStyle = "#6b7280"; g.font = `600 28px ${bodyFont}`;
      g.fillText(card.pageInfo.idx < card.pageInfo.total - 1 ? `${card.pageInfo.idx + 1}/${card.pageInfo.total} · 다음 장에 계속 →` : `${card.pageInfo.idx + 1}/${card.pageInfo.total}`, bx + bw - 30, by + bh - 30);
    }
    g.restore();
  } else if (card.photo) {
    try {
      const img = await loadImg(card.photo);
      const pw = W, ph = H - photoTop;
      const s = Math.max(pw / img.width, ph / img.height);
      const iw = img.width * s, ih = img.height * s;
      g.save(); g.beginPath(); g.rect(0, photoTop, pw, ph); g.clip();
      g.drawImage(img, (pw - iw) / 2, photoTop + (ph - ih) / 2, iw, ih);
      // 아래쪽을 살짝 어둡게 → 기록 글씨가 어떤 사진에서도 잘 보이게
      const sh = g.createLinearGradient(0, H - 300, 0, H);
      sh.addColorStop(0, "rgba(15,12,24,0)"); sh.addColorStop(1, "rgba(15,12,24,0.88)");
      g.fillStyle = sh; g.fillRect(0, H - 300, W, 300);
      g.restore();
      photoDone = true;
    } catch { drawBodyText(g, card.lines.join("\n") || card.title, bx, by, bw, bh, bodyFont); }
  } else {
    g.fillStyle = "rgba(255,255,255,0.05)"; roundRect(g, bx, by, bw, bh, 32); g.fill();
    drawBodyText(g, card.body ?? card.lines.join("\n"), bx + 40, by + 40, bw - 80, bh - 80, bodyFont);
  }

  // 맨 아래: 피드백
  const fb = card.feedback ?? card.lines[0] ?? "";
  if (fb) {
    g.textAlign = "left"; g.fillStyle = "#ffffff"; g.font = `700 42px ${bodyFont}`;
    if (photoDone) { g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 8; }
    const ls = wrap(g, `💬 ${fb}`, W - 140).slice(0, 2);
    const y0 = photoDone ? H - 70 - (ls.length - 1) * 54 : 1180;
    ls.forEach((l, i) => g.fillText(l, 70, y0 + i * 54));
    if (photoDone) g.restore();
  }
  g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.35)"; g.font = `500 24px ${bodyFont}`;
  g.fillText("super hannip Challenge", W / 2, H - 22);
  return await new Promise<Blob>((res) => c.toBlob(b => res(b!), "image/png"));
}

export function loadImg(src: string): Promise<HTMLImageElement> {
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

export function cssVar(name: string, fallback: string) {
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

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** 이게돼 (2026-11-21 고침): 바깥 틀은 다른 자랑 사진과 똑같고(프로필·이름 이게돼·인증 번호·시계),
 *  가운데 사진 자리에 카톡 대화 화면(연회색 바탕 + 흰 말풍선)이 들어간다. 글이 길면 4:5 그대로 여러 장. */
/**
 * 이게돼 공유 사진 (2026-11-24 해이 확정): 앱에서 이게돼 글을 눌렀을 때 뜨는 카드 그대로 —
 * 테마 배경색 한 장에 '#이게돼' · '이름 · 날짜 시각' · 글만. 테두리·번호·로고 없음 (번호는 붙여넣는 글에만).
 * 글이 길면 4:5 사진 여러 장으로 나눠서 전부 보낸다.
 */
export async function makeItgeImages(card: ProofCard): Promise<Blob[]> {
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  try { await (document as any).fonts?.ready; } catch {}
  const W = 1080, H = 1350, PX = 92, TOP = 96, BOTTOM = 96;
  const probe = document.createElement("canvas").getContext("2d")!;
  const color = (v: string, fb: string) => { probe.fillStyle = fb; if (v) probe.fillStyle = v; return probe.fillStyle as string; };
  const bg = color(cssVar("--card", ""), "#3f3848");
  const accent = color(cssVar("--primary", ""), "#b7a4f0");
  const fg = color(cssVar("--foreground", ""), "#f1f0f3");
  const muted = color(cssVar("--muted-foreground", ""), "#a9a4b0");
  const SIZE = 44, LH = Math.round(SIZE * 1.75);
  probe.font = `500 ${SIZE}px ${font}`;
  // 띄어쓰기 단위로 줄바꿈 (긴 낱말만 글자 단위로 자름)
  const lines: string[] = [];
  for (const para of (card.body ?? "").replace(/\r/g, "").trim().split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      if (probe.measureText(line + word).width <= W - PX * 2) { line += word; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ""; }
      if (/^\s+$/.test(word)) continue;
      for (const ch of Array.from(word)) {
        if (probe.measureText(line + ch).width > W - PX * 2 && line) { lines.push(line); line = ch; } else line += ch;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
  }
  const now = new Date();
  const stamp = card.stamp ?? `${card.date} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const HEAD = 230; // 첫 장 머리글 높이
  const pages: string[][] = [];
  let i = 0;
  while (i < lines.length || pages.length === 0) {
    const room = Math.floor((H - BOTTOM - TOP - (pages.length === 0 ? HEAD : 0)) / LH);
    while (pages.length > 0 && i < lines.length && lines[i] === "") i++; // 다음 장은 빈 줄로 시작하지 않게
    pages.push(lines.slice(i, i + room)); i += room;
  }
  const out: Blob[] = [];
  for (let p = 0; p < pages.length; p++) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    let y = TOP;
    if (p === 0) {
      g.fillStyle = accent; g.font = `800 64px ${font}`; g.fillText("#이게돼", PX, y + 58);
      g.fillStyle = muted; g.font = `500 38px ${font}`; g.fillText(`${card.userName ?? ""} · ${stamp}`, PX, y + 130);
      y += HEAD;
    }
    g.fillStyle = fg; g.font = `500 ${SIZE}px ${font}`;
    pages[p].forEach((l, k) => { if (l) g.fillText(l, PX, y + SIZE + k * LH); });
    out.push(await new Promise<Blob>(res => c.toBlob(b => res(b!), "image/png")));
  }
  return out;
}

/** 이미지 만들어 공유창 열기. 안 되는 환경이면 이미지 저장 + 문구 복사. 결과를 문자열로 돌려준다. */
/** 성 빼고 이름만: "임지연" → "지연", "방장해이" → "해이". 세 글자 한글 이름만 첫 글자를 뺀다(4글자·2글자·영어는 그대로) */
export function givenName(name: string | undefined | null): string {
  const n = (String(name ?? "").trim().split(/\s+/)[0] ?? "").replace(/^방장/, "");
  return /^[가-힣]{3}$/.test(n) ? n.slice(1) : n;
}

/** 카톡방 돋보기 검색용 한 줄 (2026-11-23 해이 지정): 지연식단_누적2 · 지연운동_누적3 */
export function searchTag(card: ProofCard): string {
  return `${givenName(card.userName)}${card.itemLabel ?? card.title.replace(/\s*인증$/, "")}${card.count != null ? `_누적${card.count}` : ""}`;
}

/** 카톡에 같이 보내는 글 (2026-11-23: 기록을 눌러 '카톡 글 다시 복사'에서도 같은 글을 쓰려고 따로 뺌) */
export function shareTextOf(card: ProofCard): string {
  // 2026-11-23 해이 확정 모양:
  //   #해이식단_누적12
  //   (빈 줄)
  //   ● 먹은 음식 : 레드단스          ← 짧으면 같은 줄
  //   ● 먹은 음식 :(줄바꿈)돼지 삼겹살 …  ← 길면 다음 줄
  //   (칸 사이 빈 줄)
  // 기상은 '취침 · 기상 · 수면 시간'까지만. 평가 문장("수면이 부족하면…")은 카드 안에만 (지적처럼 느껴지지 않게)
  const fb = (card.feedback ?? "").trim();
  const sections: { label: string; value: string }[] = card.shareSections?.length ? card.shareSections
    : card.itemLabel === "이게돼" ? (card.body?.trim() ? [{ label: "이게돼", value: card.body.trim() }] : []) // 2026-11-24: 일기 내용도 글로 붙여넣기
    : card.itemLabel === "기상" ? [{ label: "수면 기록", value: fb.split(" · ").slice(0, 3).join(" · ") }]
    : card.itemLabel === "운동" ? [{ label: "운동 기록", value: fb }]
    : card.itemLabel === "물" ? [{ label: "물 기록", value: fb.replace(/\s*\(목표의[^)]*\)/, "") }]
    : card.itemLabel === "체중" ? [{ label: "체중 기록", value: fb }]
    : card.itemLabel ? [{ label: "기록", value: fb }]
    : card.lines[0] ? [{ label: "기록", value: card.lines[0] }] : [];
  // 2026-11-24 해이: 기상은 '● 취침 : 새벽 1시' 처럼 한 줄씩 붙여서 (칸 사이 빈 줄 없이)
  // 2026-11-25: 물·식단·운동도 '이번 기록' + '오늘 총' 줄을 빈 줄 없이 한 줄씩
  const sleep = ["기상", "물", "식단", "운동", "스무디", "일반식"].includes(card.itemLabel ?? "");
  const body = sections.filter(s => s.value.trim())
    .map(s => sleep || s.value.length <= 22 ? `● ${s.label} : ${s.value}` : `● ${s.label} :\n${s.value}`)
    .join(sleep ? "\n" : "\n\n");
  return [`#${searchTag(card)}`, body].filter(Boolean).join("\n\n");
}

/** 인증 카드 사진 만들기 (자랑 창에서 미리 만들어 두려고 따로 뺌, 2026-11-24) */
export async function makeProofBlobs(card: ProofCard): Promise<Blob[]> {
  return card.itemLabel === "이게돼" && card.body ? await makeItgeImages(card)
    : [card.itemLabel ? await makeProofImage2(card) : await makeProofImage(card)];
}

export async function shareProof(card: ProofCard): Promise<"shared" | "cancelled" | "blocked" | "downloaded" | "preview"> {
  const text = shareTextOf(card);
  const blobs = await makeProofBlobs(card);
  return shareImages(blobs, text, `hannip_${card.date}`);
}

/** 내 폰에 저장 (2026-11-24): 갤럭시·PC는 바로 다운로드(갤러리 'Download' 앨범), 아이폰은 공유창 → '이미지 저장' */
export async function savePhotosToPhone(blobs: Blob[], baseName: string): Promise<"saved" | "shared" | "cancelled"> {
  const files = blobs.map((b, i) => new File([b], `${baseName}${blobs.length > 1 ? `_${i + 1}` : ""}.png`, { type: "image/png" }));
  const nav = navigator as any;
  if (isIOS() && nav.canShare && nav.canShare({ files })) {
    try { await nav.share({ files }); return "shared"; } catch { return "cancelled"; }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return "saved";
}

/** 이미지 여러 장을 공유창(카톡 등)으로 — 카톡 안이면 미리보기, PC면 저장 (2026-11-22: 나의 변화·비포애프터·시상식 카드도 같이 씀) */
export async function shareImages(blobs: Blob[], text: string, baseName: string): Promise<"shared" | "cancelled" | "blocked" | "downloaded" | "preview"> {
  const files = blobs.map((b, i) => new File([b], `${baseName}${blobs.length > 1 ? `_${i + 1}` : ""}.png`, { type: "image/png" }));
  const nav = navigator as any;
  if (!isKakaoInApp() && nav.canShare && nav.canShare({ files })) {
    // 2026-11-23: 글도 같이 넘긴다(카톡방 검색용). 아이폰 카톡은 사진 + 글 한 줄로 올라가고,
    // 갤럭시 카톡은 글을 버리므로 글을 미리 복사해 둔다 → 사진 올린 뒤 입력칸 길게 눌러 '붙여넣기'.
    // 2026-11-24 해이: 아이폰도 갤럭시처럼 '사진만' 넘긴다. 사진+글을 같이 넘기면 아이폰 카톡 공유창에
    // 오픈채팅방이 안 뜨는 사람이 생김 → 글은 미리 복사해 두고 붙여넣기 (갤럭시와 같은 방식)
    const android = /Android/i.test(navigator.userAgent);
    const ios = isIOS();
    if ((android || ios) && text) { navigator.clipboard?.writeText(text).catch(() => {}); } // 기다리지 않음: 공유창이 '누른 직후'에 떠야 해서
    try {
      await nav.share(ios ? { files } : { files, text });
      if ((android || ios) && text) {
        const { toast } = await import("sonner");
        toast.success(`'${text.split("\n")[0]}' 글을 복사해 뒀어요. 카톡 입력칸을 길게 눌러 붙여넣기 해 주세요.`, { duration: 6000 });
      }
      return "shared";
    } catch (e: any) {
      // 저장하느라 시간이 걸려 '누른 직후'가 아니면 브라우저가 막는다 → 버튼 한 번 더 누르게
      if (e?.name === "NotAllowedError") return "blocked";
      return "cancelled";
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

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export function isKakaoInApp(): boolean {
  return typeof navigator !== "undefined" && /KAKAOTALK/i.test(navigator.userAgent);
}

/** 카톡 안 브라우저에서 휴대폰 기본 브라우저(크롬·삼성인터넷)로 다시 열기 */
export function openInExternalBrowser() {
  // 2026-11-22: 크롬·사파리에서 인트로를 다시 보여 주지 않도록 표시를 붙인다
  const u = new URL(location.href); u.searchParams.set("from", "kakao");
  const url = u.toString();
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
