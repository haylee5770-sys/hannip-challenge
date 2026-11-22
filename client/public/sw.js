// 2026-11-22: 바탕화면 설치(앱 설치)용 서비스 워커. 아무것도 저장(캐시)하지 않는다 — 새 버전이 바로 보이게
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
