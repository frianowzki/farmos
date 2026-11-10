import { bad, requireSession } from "@/lib/server/guard";

type Ctx = { params: Promise<{ handle: string }> };

/**
 * A project's logo = its X profile picture. Fetched without keys through unavatar.io and cached
 * a day in the browser and a week on Vercel's CDN, so unavatar's free quota is barely touched.
 * 404 means "no picture"; the UI falls back to the monogram.
 */
export async function GET(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { handle } = await ctx.params;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return bad("invalid handle");
  try {
    const r = await fetch(`https://unavatar.io/x/${handle}?fallback=false`, { signal: AbortSignal.timeout(8_000), headers: { accept: "image/*" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) {
      return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=3600, s-maxage=21600" } });
    }
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 2_000_000) return new Response(null, { status: 404 });
    return new Response(buf, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=600" } });
  }
}
