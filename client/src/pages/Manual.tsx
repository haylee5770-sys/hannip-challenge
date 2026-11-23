// 📖 앱 사용설명서 (2026-11-23 해이: 앱 안에 설명서가 있어야 함)
// 설명서(/guide/index.html)를 앱 화면 안에 그대로 띄운다 → 앱 밖으로 나가지 않고, 메뉴로 바로 돌아올 수 있다
export default function Manual() {
  return (
    <div className="-mx-4 md:mx-0">
      <iframe
        src="/guide/index.html"
        title="앱 사용설명서"
        className="w-full border-0 bg-[#1d1e22] md:rounded-2xl"
        style={{ height: "calc(100dvh - 9rem - env(safe-area-inset-top))", minHeight: 480 }}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
