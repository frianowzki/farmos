/** Separator — PanelUI Separator (native-only upstream), web rebuild. Hairline, optional centered label. */
import { cn } from "@/lib/cn";

export function Separator({ label, vertical, className }: { label?: string; vertical?: boolean; className?: string }) {
  if (vertical) return <span role="separator" aria-orientation="vertical" className={cn("inline-block w-px self-stretch bg-line", className)} />;
  if (!label) return <hr className={cn("border-0 border-t border-line", className)} />;
  return (
    <div role="separator" className={cn("flex items-center gap-3 text-[11.5px] text-faint", className)}>
      <span className="h-px flex-1 bg-line" />
      <span className="font-label uppercase tracking-[0.14em]">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
