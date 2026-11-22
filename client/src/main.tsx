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
supabase.auth.onAuthStateChange(() => {
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token
          ? { authorization: `Bearer ${session.access_token}` }
          : {};
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
