"use client";
import { ArrowRight, KeyRound } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Logo } from "@/components/shell";
import { Button, Input } from "@/components/ui";

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
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="anim-rise w-full max-w-[360px]">
        <div className="mb-8 text-center">
          <Logo className="scale-[1.6]" />
          <p className="mt-5 font-serif text-[17px] italic text-muted">Your quiet desk for the loud parts of crypto.</p>
        </div>
        <form onSubmit={submit} className="rounded-xl border border-line bg-panel p-5 shadow-pop">
          <label htmlFor="passcode" className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
            <KeyRound className="h-3.5 w-3.5" /> Passcode
          </label>
          <Input id="passcode" name="passcode" type="password" autoComplete="current-password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} className="h-10 text-[15px]" placeholder="••••••••••••" />
          {err && <p className="mt-2 text-[12.5px] text-neg">{err}</p>}
          <Button type="submit" variant="primary" className="mt-4 h-9 w-full" disabled={!code || busy}>
            {busy ? "Unlocking…" : "Unlock"} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          {googleLogin && (
            <>
              <div className="my-4 flex items-center gap-3 text-[11.5px] text-faint">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <Button type="button" className="h-9 w-full" onClick={() => signIn("google", { redirectTo: safeNext })}>
                <GoogleMark /> Continue with Google
              </Button>
            </>
          )}
        </form>
        <p className="mt-4 text-center text-[12px] text-faint">Private workspace. Read-only for wallets.</p>
      </div>
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
