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

function isKakaoSdkReady() {
  return !!APP_KEY && typeof window !== "undefined" && !!window.Kakao && tryInit();
}

export function isKakaoReady() {
  // 모바일 Web Share API 또는 Kakao SDK 둘 중 하나라도 있으면 공유 가능
  return (typeof navigator !== "undefined" && !!navigator.share) || isKakaoSdkReady();
}

export async function shareKakao(text: string) {
  // 1순위: Kakao SDK (도메인 등록된 경우)
  if (isKakaoSdkReady()) {
    try {
      window.Kakao.Share.sendDefault({
        objectType: "text",
        text,
        link: {
          mobileWebUrl: window.location.origin,
          webUrl: window.location.origin,
        },
      });
      return;
    } catch {
      // SDK 실패 시 아래 fallback으로
    }
  }

  // 2순위: 모바일 Web Share API (카카오톡 포함 네이티브 공유 시트)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // 취소하거나 실패하면 클립보드로
    }
  }

  // 3순위: 클립보드 복사
  try {
    await navigator.clipboard.writeText(text);
    alert("복사됐어요! 카카오톡에 붙여넣기 해주세요.");
  } catch {
    alert("공유 텍스트:\n\n" + text);
  }
}
