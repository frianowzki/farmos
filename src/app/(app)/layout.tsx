import { AppShell } from "@/components/shell";
import { TzSync } from "@/components/tz-sync";
import { AccentSync } from "@/components/accent-picker";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <TzSync />
      <AccentSync />
      {children}
    </AppShell>
  );
}
