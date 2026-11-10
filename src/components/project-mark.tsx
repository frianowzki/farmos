"use client";
import { useState } from "react";
import { monoTone } from "@/lib/options";
import { cn } from "@/lib/cn";
import { xHandle } from "@/lib/project-utils";

export function Monogram({ name, size = 20, className, accent }: { name: string; size?: number; className?: string; accent?: string | null }) {
  const t = accent || monoTone(name || "?");
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[5px] font-serif font-medium leading-none", `tone-${t}`, className)}
    >
      {(name.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase()}
    </span>
  );
}

type P = { name: string; accent?: string | null; links?: { x?: string } | null };

/** Project logo: the project's X profile picture when it has an X link, else the monogram. */
export function ProjectMark({ p, size = 20, className }: { p: P; size?: number; className?: string }) {
  const handle = xHandle(p.links?.x);
  const [failed, setFailed] = useState<string | null>(null);
  if (!handle || failed === handle) return <Monogram name={p.name} accent={p.accent} size={size} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/avatar/x/${handle}`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(handle)}
      className={cn("shrink-0 rounded-[5px] bg-hover object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]", size >= 32 && "rounded-[10px]", className)}
      style={{ width: size, height: size }}
    />
  );
}
