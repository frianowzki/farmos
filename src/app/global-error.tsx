"use client";
import { useEffect } from "react";

/**
 * Last-resort boundary: catches errors thrown in the root layout, where the app shell itself is not
 * available. Must ship its own <html>/<body>, and must stay dependency-free — importing a component
 * that reaches a broken module would re-throw and leave the user with a blank screen.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[farmOS] root error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#f7f6f3", color: "#1d2b21" }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
          <img src="/brand/farmos-sprout.svg" alt="" width={44} height={58} style={{ marginBottom: 20, opacity: 0.6 }} />
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: "-0.015em" }}>farmOS hit a wall.</h1>
          <p style={{ marginTop: 8, maxWidth: 380, fontSize: 13.5, lineHeight: 1.6, color: "#6b7267" }}>
            The app failed to start. Nothing was saved or sent.
          </p>
          {error.digest && <p style={{ marginTop: 12, fontSize: 11, color: "#9aa094", fontVariantNumeric: "tabular-nums" }}>ref {error.digest}</p>}
          <button
            onClick={reset}
            style={{ marginTop: 24, height: 38, padding: "0 20px", borderRadius: 8, border: "1px solid #1d3e2b", background: "#1d3e2b", color: "#fff", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
