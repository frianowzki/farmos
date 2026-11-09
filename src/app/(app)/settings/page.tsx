export const dynamic = "force-dynamic";

import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };

export default function Page() {
  return <SettingsView appUrl={process.env.APP_URL ?? ""} allowedEmail={Boolean(process.env.ALLOWED_EMAIL)} />;
}
