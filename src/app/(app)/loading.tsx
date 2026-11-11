/**
 * Route-level loading state. Deliberately server-rendered and JS-free: it must paint before any
 * client bundle is parsed, so it is pure CSS on a few generic blocks rather than a spinner component.
 */
export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="animate-pulse">
        <div className="h-6 w-40 rounded bg-line/70" />
        <div className="mt-2 h-3.5 w-64 rounded bg-line/50" />
        <div className="mt-7 space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3.5">
              <div className="h-8 w-8 shrink-0 rounded-full bg-line/60" />
              <div className="h-3 w-1/3 rounded bg-line/60" />
              <div className="ml-auto h-3 w-16 rounded bg-line/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
