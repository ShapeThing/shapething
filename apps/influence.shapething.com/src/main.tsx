import "@shapething/shacl-renderer/style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/index.scss";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Wikidata changes slowly, and the responses are kept in the Cache API too (see fetchJson.ts).
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// The service worker keeps the app itself available offline. In development it would serve stale
// modules, so it is only used in production.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
    console.warn("The service worker could not be registered:", error);
  });
}
