import { NextResponse } from "next/server";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { saveConnection } from "@/lib/server/connections";

/** Link a Farcaster profile by username from the public Farcaster (Warpcast) API. Display only, not a verified login. */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const { username } = await readJson<{ username?: string }>(req);
  const u = String(username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-.]{0,31}$/.test(u)) return bad("Enter a Farcaster username");
  const res = await fetch(`https://api.warpcast.com/v2/user-by-username?username=${encodeURIComponent(u)}`, { cache: "no-store" });
  if (res.status === 404) return bad("No Farcaster user with that name", 404);
  if (!res.ok) return bad(`Farcaster API returned ${res.status}`, 502);
  const j = (await res.json()) as { result?: { user?: { fid: number; username: string; displayName?: string; pfp?: { url?: string }; followerCount?: number; followingCount?: number; profile?: { bio?: { text?: string } } } } };
  const user = j.result?.user;
  if (!user) return bad("No Farcaster user with that name", 404);
  await saveConnection({
    provider: "farcaster",
    providerAccountId: String(user.fid),
    username: user.username,
    name: user.displayName ?? null,
    image: user.pfp?.url ?? null,
    profile: { fid: user.fid, followers: user.followerCount ?? null, following: user.followingCount ?? null, bio: user.profile?.bio?.text ?? null, verified: false },
  });
  return NextResponse.json({ ok: true });
}
