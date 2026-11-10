"use client";
import { useEffect } from "react";

/**
 * Registers the offline-shell service worker in production only. The SW script itself is never
 * HTTP-cached (updateViaCache "none" + no-store header), it is re-checked whenever the app comes
 * back to the foreground, and a new version takes over and reloads the page once, so an
 * installed PWA can't keep serving an old build.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const hadController = Boolean(sw.controller);
    let reloaded = false;
    const onChange = () => {
      if (!hadController || reloaded) return; // first install: nothing stale to replace
      reloaded = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onChange);
    let reg: ServiceWorkerRegistration | undefined;
    sw.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        if (r.waiting) r.waiting.postMessage("skipWaiting");
        r.update().catch(() => undefined);
      })
      .catch(() => undefined);
    const onVisible = () => document.visibilityState === "visible" && reg?.update().catch(() => undefined);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sw.removeEventListener("controllerchange", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
