"use client";
import { ArrowRight, KeyRound } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Logo } from "@/components/shell";
import { Button, Input } from "@/components/ui";
import { TextReveal } from "@/components/motion/text-reveal";

export function LoginForm({ next, error, googleLogin }: { next: string; error?: string; googleLogin: boolean }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(error === "AccessDenied" ? "That Google account is not allowed here." : error ? "Sign-in failed. Try again." : "");
  const [busy, setBusy] = useState(false);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: code }) });
    if (res.ok) {
      window.location.href = safeNext;
      return;
    }
    const j = await res.json().catch(() => ({}));
    setErr(j.error ?? "Wrong passcode.");
    setBusy(false);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex items-center justify-center px-5 py-12">
        <div className="anim-rise w-full max-w-[360px]">
          <Logo className="mb-10 origin-left scale-[1.35]" />
          <TextReveal as="h1" split="word" text="Welcome back." className="font-serif text-[34px] leading-[1.1] tracking-[-0.015em] text-ink" />
          <p className="mt-2 text-[14px] text-muted">Enter your passcode to open the desk.</p>
          <form onSubmit={submit} className="mt-7">
            <label htmlFor="passcode" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
              <KeyRound className="h-3.5 w-3.5 text-muted" /> Passcode
            </label>
            <Input id="passcode" name="passcode" type="password" autoComplete="current-password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="h-10 text-[15px]" placeholder="••••••••••••" aria-invalid={Boolean(err) || undefined} aria-describedby={err ? "login-error" : undefined} />
            {err && <p id="login-error" role="alert" className="mt-2 text-[12.5px] text-neg">{err}</p>}
            <Button type="submit" variant="primary" className="mt-4 h-10 w-full text-[14px]" disabled={!code || busy}>
              {busy ? "Unlocking…" : "Unlock"} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            {googleLogin && (
              <>
                <div className="my-5 flex items-center gap-3 text-[11.5px] text-faint">
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </div>
                <Button type="button" className="h-10 w-full text-[14px]" onClick={() => signIn("google", { redirectTo: safeNext })}>
                  <GoogleMark /> Continue with Google
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="font-label text-[11px] font-medium uppercase tracking-[0.18em] text-muted">farmOS · personal edition</div>
        <div className="max-w-[440px]">
          <p className="font-serif text-[30px] italic leading-[1.2] text-ink">Your quiet desk for the loud parts of crypto.</p>
          <ul className="mt-8 space-y-3 text-[14px] text-ink-2">
            {[
              ["Airdrops & testnets", "one database, table, board or list"],
              ["Daily routine", "streaks, heatmap and a recap of every day"],
              ["Upcoming mints", "OpenSea drops with WL checks on your wallets"],
              ["Research desk", "your own model, live on-chain and market tools"],
            ].map(([a, b]) => (
              <li key={a} className="flex gap-3 border-t border-line pt-3">
                <span className="w-44 shrink-0 font-medium text-ink">{a}</span>
                <span className="text-muted">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="num text-[11.5px] text-faint">Read-only by design.</div>
      </aside>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
