export function isKakaoReady() {
  return true; // 항상 공유 버튼 표시
}

export async function shareKakao(text: string) {
  // 모바일: 네이티브 공유 시트 (카카오톡 포함)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // 취소 시 무시
      return;
    }
  }

  // PC: 클립보드 복사
  try {
    await navigator.clipboard.writeText(text);
    alert("복사됐어요! 카카오톡에 붙여넣기 해주세요 😊");
  } catch {
    alert("공유 내용:\n\n" + text);
  }
}
