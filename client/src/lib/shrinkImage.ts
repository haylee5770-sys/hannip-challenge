// 사진 줄여서 올리기 (2026-11-22): 폰 원본(3~10MB)을 긴 변 1080px · JPEG 80%(약 0.1~0.2MB)로 줄여서 서버에 저장한다.
// 카톡방에 보내는 인증 카드는 폰에서 따로 만들어 보내므로 이 크기와 상관없다.
export async function shrinkFile(file: File, maxSide = 1080, quality = 0.8): Promise<string> {
  const raw = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  return shrinkDataUrl(raw, maxSide, quality);
}

export async function shrinkDataUrl(raw: string, maxSide = 1080, quality = 0.8): Promise<string> {
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = raw; });
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) return raw;
    const k = Math.min(1, maxSide / Math.max(w0, h0));
    const w = Math.round(w0 * k), h = Math.round(h0 * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); if (!g) return raw;
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const out = c.toDataURL("image/jpeg", quality);
    // 이미 작은 사진이면 원래 것이 더 작을 수 있다
    return out.length < raw.length ? out : raw;
  } catch { return raw; }
}
