jus/**
 * main.tsx
 * App entry point: mounts React with the Query, Router, and Auth providers.
 */

// Strip stale theme artifacts from a previous session before anything renders.
document.documentElement.classList.remove("dark");
localStorage.removeItem("ptt_theme");

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import { AuthProvider } from "@/context/AuthContext";
import "@/styles/globals.css";
import "frappe-gantt/dist/frappe-gantt.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);