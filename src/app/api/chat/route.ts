import { NextResponse } from "next/server";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { aiModel, aiToolsEnabled, buildTools, systemFor } from "@/lib/server/ai";
import { bad, readJson, requireProfile } from "@/lib/server/guard";

export const maxDuration = 300;

type Body = { id?: string; messages?: UIMessage[]; mode?: string; projectId?: string | null };

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id, messages, mode = "chat", projectId } = await readJson<Body>(req);
  if (!id || !/^[A-Za-z0-9_-]{6,80}$/.test(id) || !Array.isArray(messages)) return bad("invalid request");

  // Thread ids come from the browser: never continue (or overwrite) another profile's thread.
  const [owner] = await db().select({ p: schema.chatThreads.profileId }).from(schema.chatThreads).where(eq(schema.chatThreads.id, id)).limit(1);
  if (owner && owner.p !== pid) return bad("invalid request", 409);

  let model;
  try {
    model = await aiModel(pid);
  } catch (e) {
    return bad((e as Error).message, 412);
  }

  let projectContext: string | undefined;
  if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
    const [p] = await db().select().from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, projectId))).limit(1);
    if (p) {
      const { notes, ...rest } = p;
      projectContext = JSON.stringify({ ...rest, notes: notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000) });
    }
  }

  const useTools = await aiToolsEnabled(pid);
  const tools = buildTools(pid);
  const result = streamText({
    model,
    system: systemFor(mode, projectContext),
    messages: await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
    ...(useTools ? { tools, stopWhen: isStepCount(10) } : {}),
  });

  const firstUser = messages.find((m) => m.role === "user");
  const firstText = firstUser?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
  const title = (firstText?.text ?? "New chat").replace(/\s+/g, " ").slice(0, 80);

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onEnd: async ({ messages: all }) => {
        await db()
          .insert(schema.chatThreads)
          .values({ id, title, mode, messages: all, profileId: pid })
          .onConflictDoUpdate({ target: schema.chatThreads.id, set: { messages: all, mode, updatedAt: new Date() }, setWhere: eq(schema.chatThreads.profileId, pid) });
      },
      onError: (e) => (e instanceof Error ? e.message : String(e)).slice(0, 400),
    }),
  });
}
