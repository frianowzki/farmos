"use client";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { Logo } from "@/components/shell";

/**
 * Route-level error boundary for the signed-in app. The shell (sidebar, header) stays mounted, so a
 * crashing view never takes the whole workspace with it — only the panel area is replaced.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[farmOS] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <Logo mark className="mb-6 h-11 opacity-60" />
      <h1 className="font-serif text-[26px] leading-tight tracking-[-0.015em] text-ink">This view didn&apos;t load.</h1>
      <p className="mt-2 max-w-[380px] text-[13.5px] text-muted">
        Something broke while rendering this page. Your data is untouched — nothing was saved or sent.
      </p>
      {error.digest && <p className="num mt-3 text-[11px] text-faint">ref {error.digest}</p>}
      <div className="mt-6 flex items-center gap-2">
        <Button onClick={reset} variant="primary" className="h-9 gap-1.5 text-[13.5px]">
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    </div>
  );
}
