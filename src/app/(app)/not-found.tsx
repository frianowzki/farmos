import Link from "next/link";
import { Logo } from "@/components/shell";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <Logo mark className="mb-6 h-11 opacity-60" />
      <p className="num text-[11.5px] uppercase tracking-[0.18em] text-faint">404</p>
      <h1 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.015em] text-ink">Nothing planted here.</h1>
      <p className="mt-2 max-w-[360px] text-[13.5px] text-muted">
        This page doesn&apos;t exist, or the project behind it was deleted.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-md border border-line bg-panel px-4 text-[13.5px] font-medium text-ink transition-colors hover:bg-hover"
      >
        Back to Today
      </Link>
    </div>
  );
}
