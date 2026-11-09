import { db, schema } from "@/db";
import { requireSession } from "@/lib/server/guard";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const d = db();
  const [projects, positions, tasks, completions, diary, wallets, threads] = await Promise.all([
    d.select().from(schema.projects),
    d.select().from(schema.positions),
    d.select().from(schema.tasks),
    d.select().from(schema.taskCompletions),
    d.select().from(schema.diaryEntries),
    d.select().from(schema.wallets),
    d.select().from(schema.chatThreads),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), projects, positions, tasks, completions, diary, wallets, threads }, null, 2);
  return new Response(body, {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="frioos-backup-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
