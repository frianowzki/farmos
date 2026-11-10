/**
 * Accent colours. Presets are curated pairs (light-mode / dark-mode hex); "time" follows the hour of the
 * day, "daily" picks a preset per date, "custom" uses any colour. Stored per device and per profile in
 * localStorage; the boot script in the root layout applies the last one before first paint.
 */
export type AccentPreset = { id: string; label: string; light: string; dark: string };
export const ACCENTS: AccentPreset[] = [
  { id: "terracotta", label: "Terracotta", light: "#b8572b", dark: "#e07a48" },
  { id: "amber", label: "Amber", light: "#995c0b", dark: "#e6a23c" },
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
export type AccentPref = { mode: AccentMode; id?: string; custom?: string; /** resolved safe pair for the boot script */ pair?: [string, string] };
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

// WCAG contrast helpers: every accent keeps ≥4.5:1 for button text (white on light, near-black on dark)
// and as text on the page background.
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => m - n); return (y + 0.05) / (x + 0.05); };
const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
/** Darken (light mode) / lighten (dark mode) a custom colour until text on it and it on the page both pass 4.5:1. */
export function safeCustom(c: string): { light: string; dark: string } {
  let light = c, dark = c;
  for (let t = 0; t <= 1 && (contrast(light, "#ffffff") < 4.6 || contrast(light, "#fbfaf7") < 4.5); t += 0.04) light = mix(c, "#000000", t);
  for (let t = 0; t <= 1 && (contrast(dark, "#141311") < 4.6 || contrast(dark, "#171615") < 4.5); t += 0.04) dark = mix(c, "#ffffff", t);
  return { light, dark };
}
/** Light/dark colours for a preference (null = the stylesheet default). */
export function resolveAccent(p: AccentPref, now = new Date()): { light: string; dark: string } | null {
  if (p.mode === "time") return timeAccent(now.getHours());
  if (p.mode === "daily") return dailyAccent(now);
  if (p.mode === "custom" && p.custom && HEX.test(p.custom)) return safeCustom(p.custom);
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
  if (p.mode === "custom" && p.custom && HEX.test(p.custom)) { const s = safeCustom(p.custom); p = { ...p, pair: [s.light, s.dark] }; }
  localStorage.setItem(accentKey(pid), JSON.stringify(p));
  localStorage.setItem(ACCENT_KEY, JSON.stringify(p));
}

/** Inline boot script (runs before paint) — mirrors resolveAccent for the last used preference. */
export const ACCENT_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(ACCENT_KEY)})||"null");if(!p)return;var A=${JSON.stringify(Object.fromEntries(ACCENTS.map((a) => [a.id, [a.light, a.dark]])))};var d=new Date(),h=d.getHours(),c=null;
if(p.mode==="time"){var t=h<5?"indigo":h<9?"amber":h<14?"teal":h<18?"terracotta":h<21?"plum":"indigo";c=A[t];}
else if(p.mode==="daily"){var ids=${JSON.stringify(ACCENTS.filter((a) => a.id !== "graphite").map((a) => a.id))};var n=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);c=A[ids[((n*7)%ids.length+ids.length)%ids.length]];}
else if(p.mode==="custom"&&p.pair&&p.pair.length===2){c=p.pair;}
else if(p.id&&p.id!=="terracotta"&&A[p.id]){c=A[p.id];}
if(!c)return;var e=document.documentElement;e.setAttribute("data-accent",p.mode==="preset"?p.id:p.mode);e.style.setProperty("--acc-light",c[0]);e.style.setProperty("--acc-dark",c[1]);}catch(_){}})();`;
