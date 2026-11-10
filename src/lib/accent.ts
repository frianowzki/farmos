/**
 * Accent colours. Presets are curated pairs (light-mode / dark-mode hex); "time" follows the hour of the
 * day, "daily" picks a preset per date, "custom" uses any colour. Stored per device and per profile in
 * localStorage; the boot script in the root layout applies the last one before first paint.
 */
export type AccentPreset = { id: string; label: string; light: string; dark: string };
export const ACCENTS: AccentPreset[] = [
  { id: "terracotta", label: "Terracotta", light: "#b8572b", dark: "#e07a48" },
  { id: "amber", label: "Amber", light: "#a8650f", dark: "#e6a23c" },
  { id: "moss", label: "Moss", light: "#4f7a2a", dark: "#97c463" },
  { id: "jade", label: "Jade", light: "#21795e", dark: "#4fc79c" },
  { id: "teal", label: "Teal", light: "#1d7484", dark: "#4cbed2" },
  { id: "ocean", label: "Ocean", light: "#2d64a8", dark: "#6ea4ec" },
  { id: "indigo", label: "Indigo", light: "#4f4fb8", dark: "#8f8ff0" },
  { id: "plum", label: "Plum", light: "#7d4396", dark: "#c18ae0" },
  { id: "rose", label: "Rose", light: "#b23a63", dark: "#ee7ea3" },
  { id: "graphite", label: "Graphite", light: "#4a4740", dark: "#cfcac0" },
];
export type AccentMode = "preset" | "time" | "daily" | "custom";
export type AccentPref = { mode: AccentMode; id?: string; custom?: string };
export const DEFAULT_ACCENT: AccentPref = { mode: "preset", id: "terracotta" };

/** Dawn amber → day teal → afternoon terracotta → evening plum → night indigo. */
export function timeAccent(hour: number): AccentPreset {
  const id = hour < 5 ? "indigo" : hour < 9 ? "amber" : hour < 14 ? "teal" : hour < 18 ? "terracotta" : hour < 21 ? "plum" : "indigo";
  return ACCENTS.find((a) => a.id === id)!;
}
export function dailyAccent(d = new Date()): AccentPreset {
  const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const pool = ACCENTS.filter((a) => a.id !== "graphite");
  return pool[((n * 7) % pool.length + pool.length) % pool.length];
}
const HEX = /^#[0-9a-f]{6}$/i;
/** Light/dark colours for a preference (null = the stylesheet default). */
export function resolveAccent(p: AccentPref, now = new Date()): { light: string; dark: string } | null {
  if (p.mode === "time") return timeAccent(now.getHours());
  if (p.mode === "daily") return dailyAccent(now);
  if (p.mode === "custom" && p.custom && HEX.test(p.custom)) return { light: p.custom, dark: `color-mix(in oklab, ${p.custom} 78%, white)` };
  const a = ACCENTS.find((x) => x.id === p.id);
  return !a || a.id === "terracotta" ? null : a;
}

export const ACCENT_KEY = "farmos:accent";
export const accentKey = (pid: string) => `${ACCENT_KEY}:${pid}`;

export function applyAccent(p: AccentPref) {
  const el = document.documentElement;
  const r = resolveAccent(p);
  if (!r) {
    el.removeAttribute("data-accent");
    el.style.removeProperty("--acc-light");
    el.style.removeProperty("--acc-dark");
    return;
  }
  el.setAttribute("data-accent", p.mode === "preset" ? p.id ?? "x" : p.mode);
  el.style.setProperty("--acc-light", r.light);
  el.style.setProperty("--acc-dark", r.dark);
}

export function readAccent(pid: string): AccentPref {
  try {
    const v = JSON.parse(localStorage.getItem(accentKey(pid)) ?? "null") as AccentPref | null;
    if (v && ["preset", "time", "daily", "custom"].includes(v.mode)) return v;
  } catch {}
  return DEFAULT_ACCENT;
}
export function saveAccent(pid: string, p: AccentPref) {
  localStorage.setItem(accentKey(pid), JSON.stringify(p));
  localStorage.setItem(ACCENT_KEY, JSON.stringify(p));
}

/** Inline boot script (runs before paint) — mirrors resolveAccent for the last used preference. */
export const ACCENT_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(ACCENT_KEY)})||"null");if(!p)return;var A=${JSON.stringify(Object.fromEntries(ACCENTS.map((a) => [a.id, [a.light, a.dark]])))};var d=new Date(),h=d.getHours(),c=null;
if(p.mode==="time"){var t=h<5?"indigo":h<9?"amber":h<14?"teal":h<18?"terracotta":h<21?"plum":"indigo";c=A[t];}
else if(p.mode==="daily"){var ids=${JSON.stringify(ACCENTS.filter((a) => a.id !== "graphite").map((a) => a.id))};var n=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);c=A[ids[((n*7)%ids.length+ids.length)%ids.length]];}
else if(p.mode==="custom"&&/^#[0-9a-f]{6}$/i.test(p.custom||"")){c=[p.custom,"color-mix(in oklab, "+p.custom+" 78%, white)"];}
else if(p.id&&p.id!=="terracotta"&&A[p.id]){c=A[p.id];}
if(!c)return;var e=document.documentElement;e.setAttribute("data-accent",p.mode==="preset"?p.id:p.mode);e.style.setProperty("--acc-light",c[0]);e.style.setProperty("--acc-dark",c[1]);}catch(_){}})();`;
