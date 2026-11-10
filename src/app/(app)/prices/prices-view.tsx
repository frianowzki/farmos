"use client";
import { Page, PageHeader } from "@/components/shell";
import { Converter } from "@/components/converter";
import { SectionTitle } from "@/components/ui";
import { Watchlist } from "@/components/watchlist";

export function PricesView() {
  return (
    <Page>
      <PageHeader title="Prices" subtitle="Convert any CoinGecko token to USDT, IDR and PHP, and watch the tokens you farm." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="min-w-0">
          <SectionTitle>Converter</SectionTitle>
          <div className="rounded-xl border border-line bg-panel p-4">
            <Converter />
          </div>
          <p className="mt-2 text-[11.5px] text-faint">Type in any field. Commas and dots both work (1.000.000 or 1,000,000).</p>
        </section>
        <section className="min-w-0">
          <SectionTitle>Watchlist</SectionTitle>
          <Watchlist />
        </section>
      </div>
    </Page>
  );
}
