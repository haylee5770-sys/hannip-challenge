// 주소 입력 (2026-11-22): [🔍 주소 검색](카카오·다음 우편번호, 무료) → 기본 주소 자동 → 동·호수만 직접
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
let loading: Promise<void> | null = null;
function loadPostcode(): Promise<void> {
  if ((window as any).daum?.Postcode) return Promise.resolve();
  if (!loading) loading = new Promise((res, rej) => { const s = document.createElement("script"); s.src = SRC; s.onload = () => res(); s.onerror = rej; document.head.appendChild(s); });
  return loading;
}

const field = "w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base outline-none focus:border-primary";

/** value = "(우편번호) 기본 주소, 동·호수" 한 줄 */
export default function AddressField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [base, setBase] = useState(value);
  const [detail, setDetail] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; loadPostcode().then(() => {
    const P = (window as any).daum.Postcode;
    new P({
      oncomplete: (d: any) => {
        const road = d.roadAddress || d.jibunAddress || d.address;
        const extra = [d.bname, d.buildingName].filter(Boolean).join(", ");
        const b = `(${d.zonecode}) ${road}${extra ? ` (${extra})` : ""}`;
        setBase(b); setDetail(""); onChange(b); setOpen(false);
      },
      width: "100%", height: "100%",
    }).embed(boxRef.current);
  }).catch(() => setOpen(false)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl border border-primary/60 py-3 text-sm font-bold text-primary">🔍 주소 검색</button>
      {base && <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed">{base}</div>}
      <input className={field} value={detail} onChange={e => { setDetail(e.target.value); onChange(`${base}${e.target.value ? `, ${e.target.value}` : ""}`); }}
        placeholder={base ? "동·호수 (예: 101동 1001호)" : "먼저 주소 검색을 눌러 주세요"} disabled={!base} />
      {open && (
        <div className="fixed inset-0 z-[140] bg-black/70 flex flex-col p-3" onClick={() => setOpen(false)}>
          <div className="flex justify-end pb-2"><button type="button" className="rounded-full bg-white/90 p-2 text-black"><X className="h-5 w-5" /></button></div>
          <div ref={boxRef} className="flex-1 rounded-2xl overflow-hidden bg-white" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
