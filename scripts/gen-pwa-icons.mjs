// Renders PWA icons from src/app/icon.svg (brand mark). Run: node scripts/gen-pwa-icons.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("src/app/icon.svg", "utf8");
const glyph = svg.match(/<path[^>]+\/>/)[0];
// Maskable: full-bleed background, glyph inside the 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#b8572b"/><g transform="translate(9.6 9.6) scale(0.7)">${glyph}</g></svg>`;
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#b8572b"/>${glyph}</svg>`;
const jobs = [
  [svg, 192, "public/icons/icon-192.png"],
  [svg, 512, "public/icons/icon-512.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
  [maskable, 192, "public/icons/maskable-192.png"],
  [square, 180, "public/icons/apple-touch-icon.png"],
];
for (const [s, size, out] of jobs) await sharp(Buffer.from(s), { density: 600 }).resize(size, size).png().toFile(out);
console.log("ok");
