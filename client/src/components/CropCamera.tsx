// 📷 바로 찍기 — 앱 안 카메라 (2026-11-23 해이)
// 인증 카드 사진 칸과 같은 비율의 틀만 보이고 바깥은 검게 가린다. (2026-11-25: 새 디자인 사진 칸 1080 × 1050)
// 찍으면 틀 안에 보이던 그대로만 잘라서 넘긴다 (전체로 찍었는데 카드에는 가운데만 나오던 문제).
// 카메라를 못 열면(권한 거절·카톡 안 브라우저 등) 휴대폰 기본 카메라로 넘어간다.
import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";

export const PROOF_PHOTO_RATIO = 1080 / 1050; // proofCard.ts makeProofImage2 의 사진 칸 (가로 끝까지 1080 × 시간 아래부터 바닥까지 1050)

export function canUseInAppCamera() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export default function CropCamera({ ratio = PROOF_PHOTO_RATIO, onShot, onClose, onFallback }: {
  ratio?: number;
  onShot: (f: File) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        const v = videoRef.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        setReady(true);
      } catch {
        if (alive) { onClose(); onFallback(); }
      }
    })();
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps

  // 뒤 화면 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const shoot = async () => {
    const v = videoRef.current, box = boxRef.current, fr = frameRef.current;
    if (!v || !box || !fr || !v.videoWidth) return;
    setBusy(true);
    try {
      // 화면(object-cover)에 보이는 틀 위치 → 원본 영상 좌표로 바꿔서 그 부분만 자른다
      const b = box.getBoundingClientRect(), f = fr.getBoundingClientRect();
      const vw = v.videoWidth, vh = v.videoHeight;
      const s = Math.max(b.width / vw, b.height / vh);
      const dx = (b.width - vw * s) / 2, dy = (b.height - vh * s) / 2;
      let sx = (f.left - b.left - dx) / s;
      const sy = (f.top - b.top - dy) / s;
      const sw = f.width / s, sh = f.height / s;
      if (facing === "user") sx = vw - (sx + sw); // 셀카 화면은 거울처럼 보여 주므로 되돌림
      const outW = Math.min(1350, Math.round(sw)), outH = Math.round(outW / ratio);
      const c = document.createElement("canvas"); c.width = outW; c.height = outH;
      const g = c.getContext("2d")!;
      if (facing === "user") { g.translate(outW, 0); g.scale(-1, 1); }
      g.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH);
      const blob: Blob = await new Promise((res, rej) => c.toBlob(bl => (bl ? res(bl) : rej(new Error("blob"))), "image/jpeg", 0.9));
      onShot(new File([blob], `shot_${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button type="button" onClick={onClose} aria-label="닫기" className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center"><X className="h-5 w-5" /></button>
        <span className="text-sm font-semibold">틀 안에 보이는 부분만 올라가요</span>
        <button type="button" onClick={() => setFacing(f => (f === "environment" ? "user" : "environment"))} aria-label="카메라 바꾸기"
          className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center"><RefreshCw className="h-5 w-5" /></button>
      </div>
      <div ref={boxRef} className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
        {/* 카드 사진 칸과 같은 비율의 틀. 바깥은 검게 */}
        <div ref={frameRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/90"
          style={{ width: `min(92vw, ${70 * ratio}vh)`, aspectRatio: String(ratio), boxShadow: "0 0 0 200vmax rgba(0,0,0,0.88)" }} />
        {!ready && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>}
      </div>
      <div className="flex items-center justify-center py-5">
        <button type="button" onClick={shoot} disabled={!ready || busy} aria-label="찍기"
          className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40">
          <span className="h-16 w-16 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
