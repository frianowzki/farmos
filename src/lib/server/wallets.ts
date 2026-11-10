import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";

/** Make one wallet the profile's default (clears the others first; a partial unique index keeps it to one). */
export async function setDefaultWallet(pid: string, id: string) {
  await db().update(schema.wallets).set({ isDefault: false }).where(and(eq(schema.wallets.profileId, pid), eq(schema.wallets.isDefault, true), ne(schema.wallets.id, id)));
  const [row] = await db().update(schema.wallets).set({ isDefault: true }).where(and(eq(schema.wallets.profileId, pid), eq(schema.wallets.id, id))).returning();
  return row ?? null;
}
