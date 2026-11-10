"use client";
import { useState } from "react";
import { MailList } from "@/components/mail";
import { Page, PageHeader } from "@/components/shell";
import { cn } from "@/lib/cn";

export default function MailPage() {
  const [days, setDays] = useState(14);
  return (
    <Page>
      <PageHeader
        title="Mail"
        subtitle="Recent Gmail, matched to projects by sender domain, links and keywords. Flags whitelist, KYC, claim and mint mail."
        right={
          <div className="flex rounded-md border border-line bg-panel p-0.5">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cn("h-7 rounded-[5px] px-2.5 text-[12.5px]", days === d ? "bg-active text-ink" : "text-muted hover:text-ink")}>{d}d</button>
            ))}
          </div>
        }
      />
      <MailList days={days} />
    </Page>
  );
}
