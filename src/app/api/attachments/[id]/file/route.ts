import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { attachmentPrefix } from "@/lib/server/backup";
import { db, schema } from "@/db";
import { bad, requireProfile } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };

/** Private blobs are streamed through the gated app, never exposed by URL. */
export async function GET(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("not found", 404);
  const [row] = await db().select().from(schema.attachments).where(and(eq(schema.attachments.profileId, pid), eq(schema.attachments.id, id))).limit(1);
  // The blob must also sit in this profile's folder (defense against a crafted row).
  if (!row || !row.pathname.startsWith(attachmentPrefix(pid)) || (pid === "default" && row.pathname.startsWith("profiles/"))) return bad("not found", 404);
  const r = await get(row.pathname, { access: "private" });
  if (!r || r.statusCode !== 200) return bad("not found", 404);
  const download = new URL(req.url).searchParams.has("download");
  const inline = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|text\/plain)$/.test(row.contentType ?? "");
  return new Response(r.stream, {
    headers: {
      "content-type": row.contentType ?? "application/octet-stream",
      "content-disposition": `${download || !inline ? "attachment" : "inline"}; filename="${encodeURIComponent(row.name)}"`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
