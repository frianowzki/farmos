import { AppShell } from "@/components/shell";
import { TzSync } from "@/components/tz-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <TzSync />
      {children}
    </AppShell>
  );
}
