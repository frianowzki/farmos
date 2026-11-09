/**
 * GridItem — PanelUI's bento Grid Item (native-only upstream), web rebuild: tiles and the grid that places them.
 * Tiles span columns/rows; content is the caller's (usually a PanelUI Kpi).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>{children}</div>;
}

export function GridItem({ children, span = 1, rows = 1, className }: { children: ReactNode; span?: 1 | 2 | 3 | 4; rows?: 1 | 2; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-line bg-panel",
        span === 2 && "col-span-2",
        span === 3 && "col-span-2 md:col-span-3",
        span === 4 && "col-span-2 md:col-span-4",
        rows === 2 && "row-span-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
