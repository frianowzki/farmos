"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/lib/client/toast";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="frioos-theme" disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
          {children}
        </MotionConfig>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
