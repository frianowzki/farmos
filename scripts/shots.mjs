// Usage: FRIO_PASSCODE=... node scripts/shots.mjs <baseUrl> <outDir> [prefix] [paths...]
import { chromium } from "playwright-core";
import fs from "node:fs";
const [base, out = "screenshots", prefix = "", ...rest] = process.argv.slice(2);
const paths = rest.length ? rest : ["/login", "/", "/projects", "/tasks", "/diary", "/portfolio", "/assistant", "/wallets", "/settings", "/mail"];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const scheme of ["light", "dark"]) {
  for (const vp of [{ name: "desktop", width: 1440, height: 900, mobile: false }, { name: "mobile", width: 390, height: 844, mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    for (const p of paths) {
      if (p !== "/login" && !(await ctx.cookies()).some((c) => c.name === "frio_session")) {
        const r = await page.request.post(base + "/api/unlock", { data: { passcode: process.env.FRIO_PASSCODE } });
        if (!r.ok()) throw new Error("unlock failed " + r.status());
      }
      await page.goto(base + p, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const name = `${prefix}${p === "/" ? "today" : p.replace(/^\//, "").replace(/[/?=&]/g, "-")}-${vp.name}-${scheme}.png`;
      await page.screenshot({ path: `${out}/${name}`, fullPage: false });
      console.log(name);
    }
    await ctx.close();
  }
}
await browser.close();
