declare global {
  interface Window {
    Kakao: any;
  }
}

const APP_KEY = import.meta.env.VITE_KAKAO_JS_APP_KEY as string | undefined;
let initialized = false;

function tryInit() {
  if (initialized) return true;
  if (!APP_KEY || typeof window === "undefined" || !window.Kakao) return false;
  try {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(APP_KEY);
    }
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function isKakaoReady() {
  return !!APP_KEY && typeof window !== "undefined" && !!window.Kakao;
}

export function shareKakao(text: string) {
  if (!isKakaoReady()) return;
  if (!tryInit()) return;
  try {
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text,
      link: {
        mobileWebUrl: window.location.origin,
        webUrl: window.location.origin,
      },
    });
  } catch (e) {
    console.warn("[Kakao] share failed", e);
  }
}
