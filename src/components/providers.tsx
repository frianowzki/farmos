"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="frioos-theme" disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        {children}
        <Toaster position="bottom-right" toastOptions={{ className: "!bg-panel !text-ink !border-line !shadow-pop !text-[13px] !font-sans" }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
