import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";
import { cookies } from "next/headers";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from "@/lib/session";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET,
);

const has = (...k: string[]) => Boolean(process.env.AUTH_SECRET) && k.every((x) => process.env[x]);

/** Every provider is gated on its env vars, so a missing key just means "not set up" in Settings. */
const providers = [
  ...(googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: {
            params: { scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
          },
        }),
      ]
    : []),
  ...(has("X_CLIENT_ID", "X_CLIENT_SECRET")
    ? [
        Twitter({
          id: "x",
          name: "X",
          clientId: process.env.X_CLIENT_ID,
          clientSecret: process.env.X_CLIENT_SECRET,
          authorization: { url: "https://x.com/i/oauth2/authorize", params: { scope: "users.read tweet.read follows.read offline.access" } },
          token: "https://api.x.com/2/oauth2/token",
          userinfo: "https://api.x.com/2/users/me?user.fields=profile_image_url,username,name,public_metrics",
        }),
      ]
    : []),
  ...(has("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET")
    ? [
        // Discord now sends the RFC 9207 `iss` param on the callback. Without an explicit issuer Auth.js
        // compares it to its "https://authjs.dev" placeholder and every callback fails.
        Discord({ clientId: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET, issuer: "https://discord.com", authorization: { params: { scope: "identify" } } }),
      ]
    : []),
  ...(has("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET")
    ? [
        // Same RFC 9207 guard as Discord; GitHub has rolled `iss` out before. Unused while GitHub omits it.
        GitHub({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, issuer: "https://github.com/login/oauth", authorization: { params: { scope: "read:user" } } }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  // Errors go through /auth-error: with a live farmOS session a failed link returns to Settings instead of looking like a logout.
  pages: { signIn: "/login", error: "/auth-error" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account && account.provider !== "google") {
        // Linking only: X / Discord / GitHub never unlock the app, they attach to an unlocked session.
        const jar = await cookies();
        if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) return "/login?error=AccessDenied";
        const p = (profile ?? {}) as Record<string, unknown>;
        const data = (p.data ?? p) as Record<string, unknown>;
        const { saveConnection } = await import("@/lib/server/connections");
        const provider = account.provider as "x" | "discord" | "github";
        const username = String(data.username ?? data.login ?? p.username ?? "") || null;
        const image =
          provider === "discord" && p.avatar
            ? `https://cdn.discordapp.com/avatars/${String(p.id)}/${String(p.avatar)}.png`
            : (String(data.profile_image_url ?? data.avatar_url ?? "") || null);
        await saveConnection({
          provider,
          providerAccountId: account.providerAccountId,
          username,
          name: String(data.name ?? p.global_name ?? username ?? "") || null,
          image,
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          scope: account.scope ?? null,
          profile: provider === "x" ? { metrics: data.public_metrics ?? null } : provider === "github" ? { url: data.html_url ?? null, repos: data.public_repos ?? null } : {},
        });
        return true;
      }
      const email = (profile?.email ?? "").toLowerCase();
      const allowed = (process.env.ALLOWED_EMAIL ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
      const jar = await cookies();
      const unlocked = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
      // Without ALLOWED_EMAIL, Google can only be *linked* from an already-unlocked session.
      const ok = allowed.length ? allowed.includes(email) && profile?.email_verified !== false : unlocked;
      if (!ok) return "/login?error=AccessDenied";
      if (account?.access_token) {
        const { saveGoogleTokens } = await import("@/lib/server/google");
        await saveGoogleTokens({
          email,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          scope: account.scope ?? null,
        });
      }
      if (!unlocked) jar.set(SESSION_COOKIE, await createSessionToken(`google:${email}`), sessionCookieOptions);
      return true;
    },
    async jwt({ token }) {
      // Keep OAuth tokens out of the session cookie; they live encrypted in the DB.
      return { sub: token.sub, email: token.email, name: token.name, picture: token.picture };
    },
  },
});
