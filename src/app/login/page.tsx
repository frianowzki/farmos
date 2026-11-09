import { googleConfigured } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Unlock" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const googleLogin = googleConfigured && Boolean(process.env.ALLOWED_EMAIL);
  return <LoginForm next={sp.next ?? "/"} error={sp.error} googleLogin={googleLogin} />;
}
