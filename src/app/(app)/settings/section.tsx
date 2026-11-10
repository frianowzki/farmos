import type { ReactNode } from "react";

export function Section({ id, title, desc, children }: { id?: string; title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-4 border-t border-line py-7 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-[12.5px] text-muted">{desc}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
