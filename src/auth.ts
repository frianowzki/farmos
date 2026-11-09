import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: {
            params: { scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
          },
        }),
      ]
    : [],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
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
