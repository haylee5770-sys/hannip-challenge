// 자랑하기 카드 3종 (2026-11-22, 해이 확정 디자인): 나의 변화 · 비포애프터 · 시상식
// 기존 인증 카드와 같은 모양: 진회색 바탕 · 맨 위 연두 줄 · 왼쪽 위 내 사진 + 이름 + 연두 글씨
import { drawAvatar, roundRect, loadImg, cssVar, shareImages } from "./proofCard";

const W = 1080, H = 1350;
const FONT = "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif";

async function base(name: string, item: string, avatar: string | null | undefined) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const accent = cssVar("--primary", "#b6f24a");
  g.fillStyle = "#2b2d31"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.06)"; roundRect(g, 40, 40, W - 80, H - 80, 44); g.fill();
  g.fillStyle = accent; roundRect(g, 40, 40, W - 80, 12, 6); g.fill();
  await drawAvatar(g, avatar, 90, 110, 120, name, accent);
  let size = 64;
  for (; size > 40; size -= 4) { g.font = `900 ${size}px ${FONT}`; if (g.measureText(`${name} ${item}`).width <= W - 90 - 240) break; }
  g.textAlign = "left"; g.textBaseline = "alphabetic"; g.font = `900 ${size}px ${FONT}`;
  g.fillStyle = "#ffffff"; g.fillText(name, 235, 192);
  const nw = g.measureText(name + " ").width; g.fillStyle = accent; g.fillText(item, 235 + nw, 192);
  g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.22)"; g.font = `500 26px ${FONT}`; g.fillText("SUPER HANNIP CHALLENGE", W / 2, H - 100);
  return { c, g, accent };
}
const blob = (c: HTMLCanvasElement) => new Promise<Blob>(res => c.toBlob(b => res(b!), "image/png"));
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

/* ① 나의 변화 */
export type ChangeCard = { name: string; avatar?: string | null; seasonName: string; dayNo?: number | null; weightStart?: number | null; weightEnd?: number | null; weights?: number[];
  counts: { total: number; meal: number; water: number; exercise: number; wake: number; itge: number } };
export async function shareChangeCard(d: ChangeCard) {
  const { c, g, accent } = await base(d.name, "나의 변화", d.avatar);
  g.textAlign = "left"; g.fillStyle = "#a6a9ae"; g.font = `400 36px ${FONT}`;
  g.fillText(`${d.seasonName}${d.dayNo ? ` · ${d.dayNo}일째` : ""}`, 90, 300);
  g.fillStyle = "rgba(255,255,255,0.05)"; roundRect(g, 90, 340, 900, 280, 36); g.fill();
  g.fillStyle = "#a6a9ae"; g.font = `400 34px ${FONT}`; g.fillText("체중", 140, 400);
  const ws = d.weightStart, we = d.weightEnd;
  g.fillStyle = "#ececea"; g.font = `900 80px ${FONT}`;
  g.fillText(ws != null ? `${ws.toFixed(1)} → ${(we ?? ws).toFixed(1)}kg` : "기록 전", 140, 505);
  if (ws != null && we != null) { const dlt = we - ws; g.fillStyle = accent; g.font = `900 48px ${FONT}`; g.fillText(`${dlt >= 0 ? "+" : "−"}${Math.abs(dlt).toFixed(1)}kg`, 140, 580); }
  const pts = (d.weights ?? []).slice(-8);
  if (pts.length >= 2) {
    const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
    const xy = pts.map((v, i) => [640 + (i * 300) / (pts.length - 1), 560 - ((v - mn) / rg) * 110] as const);
    g.strokeStyle = accent; g.lineWidth = 6; g.lineJoin = "round"; g.beginPath(); xy.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.fillStyle = accent; xy.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); });
  }
  const items: Array<[string, number]> = [["전체 인증", d.counts.total], ["식단", d.counts.meal], ["물", d.counts.water], ["운동", d.counts.exercise], ["기상", d.counts.wake], ["이게돼", d.counts.itge]];
  items.forEach(([k, v], i) => {
    const x = 90 + (i % 3) * 305, y = 660 + Math.floor(i / 3) * 230;
    g.fillStyle = "rgba(255,255,255,0.05)"; roundRect(g, x, y, 285, 205, 32); g.fill();
    g.textAlign = "center"; g.fillStyle = accent; g.font = `900 88px ${FONT}`; g.fillText(String(v), x + 142, y + 122);
    g.fillStyle = "#a6a9ae"; g.font = `400 32px ${FONT}`; g.fillText(k, x + 142, y + 178);
  });
  g.textAlign = "center"; g.fillStyle = "#ececea"; g.font = `500 32px ${FONT}`; g.fillText("꾸준함이 자존감이 되고, 자존감이 인생을 바꾼다", W / 2, 1182);
  return shareImages([await blob(c)], `📈 ${d.name} · 나의 변화\n${d.seasonName}\n#super_hannip_challenge`, "hannip_change");
}

/* ② 비포 · 애프터 */
export type BACard = { name: string; avatar?: string | null; before: string; after: string; beforeDate?: string; afterDate?: string; beforeKg?: number | null; afterKg?: number | null };
export async function shareBeforeAfterCard(d: BACard) {
  const { c, g, accent } = await base(d.name, "비포 · 애프터", d.avatar);
  g.textAlign = "left"; g.fillStyle = "#a6a9ae"; g.font = `400 36px ${FONT}`;
  if (d.beforeDate && d.afterDate) g.fillText(`${d.beforeDate.slice(0, 4)}.${md(d.beforeDate)} → ${d.afterDate.slice(0, 4)}.${md(d.afterDate)}`, 90, 300);
  const slots: Array<[string, string, number | null | undefined]> = [["BEFORE", d.before, d.beforeKg], ["AFTER", d.after, d.afterKg]];
  for (let i = 0; i < 2; i++) {
    const [lab, src, kg] = slots[i]; const x = 90 + i * 460, y = 350, w = 440, h = 640;
    g.save(); roundRect(g, x, y, w, h, 24); g.clip();
    try { const img = await loadImg(src); const k = Math.max(w / img.width, h / img.height); g.drawImage(img, x + (w - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k); } catch { g.fillStyle = "#3a3d42"; g.fillRect(x, y, w, h); }
    g.restore();
    g.fillStyle = "rgba(0,0,0,0.55)"; roundRect(g, x + 20, y + 20, 180, 60, 30); g.fill();
    g.textAlign = "center"; g.fillStyle = i ? accent : "#ececea"; g.font = `800 30px ${FONT}`; g.fillText(lab, x + 110, y + 61);
    if (kg != null) { g.fillStyle = i ? accent : "#ececea"; g.font = `900 56px ${FONT}`; g.fillText(`${kg.toFixed(1)}kg`, x + w / 2, 1065); }
  }
  if (d.beforeKg != null && d.afterKg != null) {
    const dlt = d.afterKg - d.beforeKg; g.textAlign = "center"; g.fillStyle = accent; g.font = `900 44px ${FONT}`;
    g.fillText(`${dlt >= 0 ? "+" : "−"}${Math.abs(dlt).toFixed(1)}kg · 해냈어요!`, W / 2, 1150);
  }
  return shareImages([await blob(c)], `📸 ${d.name} · 비포 애프터\n#super_hannip_challenge`, "hannip_before_after");
}

/* ③ 시상식 */
export type AwardCardData = { name: string; avatar?: string | null; seasonName: string; title: string; sub: string };
export async function shareAwardCard(d: AwardCardData) {
  const { c, g, accent } = await base(d.name, "수상", d.avatar);
  g.textAlign = "center"; g.fillStyle = "#a6a9ae"; g.font = `400 38px ${FONT}`; g.fillText(`${d.seasonName} 시상식`, W / 2, 312);
  g.font = `150px ${FONT}`; g.fillText("🏆", W / 2, 480);
  g.fillStyle = accent; g.font = `900 96px ${FONT}`; g.fillText(d.title, W / 2, 600);
  g.fillStyle = "#a6a9ae"; g.font = `400 34px ${FONT}`; g.fillText(d.sub, W / 2, 662);
  await drawAvatar(g, d.avatar, W / 2 - 130, 720, 260, d.name, accent);
  g.fillStyle = "#ececea"; g.font = `900 72px ${FONT}`; g.fillText(d.name, W / 2, 1075);
  g.font = `500 30px ${FONT}`; g.fillText("나를 칭찬하는 순간, 우리 모두가 1등이 됩니다", W / 2, 1160);
  return shareImages([await blob(c)], `🏆 ${d.name} · ${d.seasonName} ${d.title}\n#super_hannip_challenge`, "hannip_award");
}

/** 자랑하기 결과 안내 (2026-11-22) */
export function shareToast(r: string, toast: { success: (m: string) => void; error: (m: string) => void }) {
  if (r === "blocked") toast.error("한 번 더 눌러 주세요 (사진 준비가 끝났어요)");
  else if (r === "downloaded") toast.success("사진을 저장했어요. 카톡방에 올려 주세요");
}
