"use client";
import { useEffect } from "react";
import { useProfile } from "@/lib/client/api";
import { appTimeZone } from "@/lib/dates";

/** Zone the page was first rendered with (read once from the frio_tz cookie). */
const renderedTz = typeof document === "undefined" ? undefined : appTimeZone();

/**
 * Sessions that predate the zone cookie (or a zone changed on another device) get the right
 * "today" after one reload: /api/profile refreshes the cookie, then we re-render once.
 */
export function TzSync() {
  const { data } = useProfile();
  useEffect(() => {
    if (!data?.tz || data.tz === renderedTz) return;
    if (sessionStorage.getItem("frio_tz_reload") === data.tz) return; // never loop
    sessionStorage.setItem("frio_tz_reload", data.tz);
    window.location.reload();
  }, [data?.tz]);
  return null;
}
