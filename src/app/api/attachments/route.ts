import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { bad, requireSession } from "@/lib/server/guard";

export const maxDuration = 60;
const MAX = 4 * 1024 * 1024; // under the 4.5 MB function body limit
const isUuid = (s: string | null) => Boolean(s && /^[0-9a-f-]{36}$/i.test(s));

export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const u = new URL(req.url);
  const projectId = u.searchParams.get("projectId");
  const diaryId = u.searchParams.get("diaryId");
  const where = isUuid(projectId) ? eq(schema.attachments.projectId, projectId!) : isUuid(diaryId) ? eq(schema.attachments.diaryId, diaryId!) : undefined;
  if (!where) return bad("projectId or diaryId required");
  const rows = await db().select().from(schema.attachments).where(where).orderBy(desc(schema.attachments.createdAt));
  return NextResponse.json({ attachments: rows });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return bad("File storage is not set up (BLOB_READ_WRITE_TOKEN missing).", 412);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const projectId = String(form?.get("projectId") ?? "") || null;
  const diaryId = String(form?.get("diaryId") ?? "") || null;
  if (!(file instanceof File)) return bad("file required");
  if (!isUuid(projectId) && !isUuid(diaryId)) return bad("projectId or diaryId required");
  if (file.size > MAX) return bad("Files up to 4 MB.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const blob = await put(`attachments/${projectId ?? diaryId}/${safe}`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type || undefined,
  });
  const [row] = await db()
    .insert(schema.attachments)
    .values({ projectId: isUuid(projectId) ? projectId : null, diaryId: isUuid(diaryId) ? diaryId : null, url: blob.url, pathname: blob.pathname, name: file.name.slice(0, 200), size: file.size, contentType: file.type || null })
    .returning();
  return NextResponse.json({ attachment: row });
}
