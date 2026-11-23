import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { NOT_APPROVED_ERR_MSG, REJECTED_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message === NOT_APPROVED_ERR_MSG) return;
  if (error.message === REJECTED_ERR_MSG) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  // Just invalidate — MembershipGate will show the login screen
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

// Re-fetch auth.me whenever Supabase session changes (login / logout / token refresh)
// 2026-11-23: 로그인 정보(토큰)를 기억해 둔다. 휴대폰에서 앱을 다시 열 때 supabase.getSession()이
// 로그인 새로 고침과 겹치면 멈춰서(동그라미만 계속 돎) 서버에 요청 자체가 안 나가던 문제 대응.
let cachedToken: string | null = null;
supabase.auth.onAuthStateChange((_e, session) => {
  cachedToken = session?.access_token ?? null;
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
});

async function getToken(): Promise<string | null> {
  const timeout = new Promise<"timeout">(res => setTimeout(() => res("timeout"), 3000));
  try {
    const r = await Promise.race([supabase.auth.getSession(), timeout]);
    if (r === "timeout") { console.warn("[auth] getSession 3초 넘게 걸려서 기억해 둔 토큰 사용"); return cachedToken; }
    cachedToken = r.data.session?.access_token ?? cachedToken;
    return r.data.session?.access_token ?? null;
  } catch {
    return cachedToken;
  }
}

/** 서버가 20초 안에 답이 없으면 끊고 다시 시도하게 (무한 대기 방지) */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  init?.signal?.addEventListener("abort", () => ctrl.abort());
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
};

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: fetchWithTimeout,
      async headers() {
        const token = await getToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// 2026-11-22: 사진 길게 누르기(오른쪽 클릭) 메뉴 막기 — 자랑하기 카드(.allow-save)는 예외
document.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement | null;
  if (t && t.tagName === "IMG" && !t.classList.contains("allow-save")) e.preventDefault();
});
