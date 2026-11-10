"use client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, ExternalLink, Play, ScanSearch, Settings2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { AirdropChecker } from "@/db/schema";
import { Button, Empty, Field, Input, NativeSelect, Pill, SelectPill } from "@/components/ui";
import { Switch } from "@/components/motion/switch";
import { EVM_CHAINS } from "@/lib/chains";
import { cn } from "@/lib/cn";
import { alertRunsLabel } from "@/lib/dates";
import { api, keys } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { shortAddr } from "@/lib/format";

const TYPES = [
  { id: "page", label: "Claim / checker page goes live" },
  { id: "api", label: "Checker API (JSON)" },
  { id: "contract", label: "Claim contract view" },
  { id: "merkle", label: "Merkle / claims list (JSON)" },
  { id: "manual", label: "Status only (set by hand)" },
] as const;

export const CLAIM_STATUS_OPTS = [
  { id: "unknown", label: "Not announced", tone: "gray" },
  { id: "upcoming", label: "Claim soon", tone: "amber" },
  { id: "open", label: "Claim open", tone: "green" },
  { id: "claimed", label: "Claimed", tone: "gray" },
  { id: "closed", label: "Closed", tone: "red" },
];

const HELP: Record<string, string> = {
  api: "The project's public eligibility endpoint. Use {address} where the wallet goes. Path picks the field, e.g. amount or data.eligible.",
  contract: "A read-only view on the claim contract that takes one address, e.g. claimable(address) returns (uint256). Never signs or sends.",
  merkle: "Public JSON of claims: { \"0xabc…\": \"123\" } or [{ address, amount }]. Path optional, e.g. claims.",
  page: "farmOS opens this page twice a day ({runs}) and alerts you on Telegram once it loads (and, if set, shows the match text, e.g. “Claim”). Works for most static pages; pages that render only in the browser or sit behind a wallet connect can't be read.",
  manual: "No automatic check. Set the claim status yourself; the badge on the project follows it.",
};

/** Per-project, read-only eligibility check. Shows nothing fake: no config → "No checker configured". */
export function AirdropCheckerPanel({ projectId, checker, wallets }: { projectId: string; checker: AirdropChecker | null; wallets: string[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: keys.project(projectId) });

  const run = async () => {
    setRunning(true);
    try {
      await api(`/api/projects/${projectId}/checker`, { method: "POST" });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setRunning(false);
  };

  if (editing) return <CheckerForm projectId={projectId} initial={checker} onDone={() => { setEditing(false); refresh(); }} />;
  if (!checker)
    return (
      <Empty
        icon={<ScanSearch className="h-5 w-5" />}
        title="No claim watch yet"
        body="Watch a claim page, a checker API, the claim contract or a published claims list. farmOS checks twice a day and pings Telegram when the claim opens or a wallet becomes eligible. Read-only: nothing is ever signed or sent."
        action={<Button onClick={() => setEditing(true)}><Settings2 className="h-3.5 w-3.5" /> Set up claim watch</Button>}
      />
    );

  const results = (checker.lastRun?.results ?? []).filter((r) => r.wallet !== "page" && r.wallet !== "check");
  const pageRun = checker.lastRun?.results.find((r) => r.wallet === "page" || r.wallet === "check");
  const eligible = results.filter((r) => r.status === "eligible").length;
  const quick = async (patch: { claimStatus?: string; autoCheck?: boolean }) => {
    try {
      await api(`/api/projects/${projectId}/checker`, { method: "PATCH", body: patch });
      refresh();
      qc.invalidateQueries({ queryKey: keys.projects });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">Claim status <SelectPill value={checker.claimStatus ?? "unknown"} options={CLAIM_STATUS_OPTS} onChange={(v) => quick({ claimStatus: v })} /></span>
        {checker.type !== "manual" && (
          <span className="flex items-center gap-2">Check twice a day + Telegram alert <Switch checked={checker.autoCheck !== false} onCheckedChange={(v) => quick({ autoCheck: v })} ariaLabel="Automatic claim check" /></span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2.5">
        <div className="min-w-0 text-[13px]">
          <div className="font-medium">{TYPES.find((t) => t.id === checker.type)?.label}</div>
          <div className="num truncate text-[12px] text-muted">{checker.type === "contract" ? `${checker.chain} · ${shortAddr(checker.address)} · ${checker.fn}` : checker.type === "manual" ? "Updated by hand" : <>{checker.url}{checker.match ? ` · “${checker.match}”` : ""}</>}</div>
        </div>
        <div className="flex gap-2">
          {checker.claimUrl && <a href={checker.claimUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /> Claim page</Button></a>}
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Settings2 className="h-3.5 w-3.5" /> Edit</Button>
          {checker.type !== "manual" && <Button size="sm" variant="primary" disabled={running} onClick={run}><Play className="h-3.5 w-3.5" /> {running ? "Checking…" : "Check now"}</Button>}
        </div>
      </div>
      {pageRun && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <Pill tone={pageRun.status === "eligible" ? "green" : pageRun.status === "error" ? "amber" : "gray"} dot>{pageRun.status === "eligible" ? "Page live" : pageRun.status === "error" ? "Check failed" : "Not live yet"}</Pill>
          <span className="min-w-0 truncate">{pageRun.detail} · {new Date(checker.lastRun!.at).toLocaleString()}</span>
        </div>
      )}
      {(checker.type === "api" || checker.type === "contract" || checker.type === "merkle") && <><p className="text-[12px] text-muted">{wallets.length ? `Checks the ${wallets.length} wallet${wallets.length > 1 ? "s" : ""} tagged on this project.` : "No wallets tagged on this project, so all linked EVM wallets are checked."}</p>
      {checker.lastRun && results.length ? (
        <>
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            <Pill tone={eligible ? "green" : "gray"} dot>{eligible} of {results.length} eligible</Pill>
            <span>checked {new Date(checker.lastRun.at).toLocaleString()}</span>
          </div>
          <div className="divide-y divide-line rounded-lg border border-line bg-panel">
            {results.map((r) => (
              <div key={r.wallet} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                {r.status === "eligible" ? <CheckCircle2 className="h-4 w-4 text-pos" /> : r.status === "error" ? <TriangleAlert className="h-4 w-4 text-[var(--t-amber-fg)]" /> : <CircleSlash className="h-4 w-4 text-faint" />}
                <span className="num min-w-0 flex-1 truncate text-ink-2">{r.wallet}</span>
                <span className={cn("num text-right", r.status === "eligible" ? "text-ink" : "text-muted")}>
                  {r.status === "eligible" ? (r.amount ? r.amount : "Eligible") : r.status === "error" ? "Error" : "Not eligible"}
                </span>
                {r.detail && <span className="hidden max-w-[220px] truncate text-[11.5px] text-faint md:inline" title={r.detail}>{r.detail}</span>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Not checked yet.</div>
      )}</>}
    </div>
  );
}

function CheckerForm({ projectId, initial, onDone }: { projectId: string; initial: AirdropChecker | null; onDone: () => void }) {
  const [c, setC] = useState<Partial<AirdropChecker>>(initial ?? { type: "page" });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<AirdropChecker>) => setC((x) => ({ ...x, ...p }));
  const save = async (clear = false) => {
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/checker`, { method: "PUT", body: { checker: clear ? null : { ...c, decimals: c.decimals === undefined || Number.isNaN(c.decimals) ? undefined : c.decimals } } });
      toast.success(clear ? "Claim watch removed" : "Claim watch saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="max-w-xl space-y-3 rounded-lg border border-line bg-panel p-4">
      <Field label="Source">
        <NativeSelect value={c.type ?? "page"} onChange={(v) => set({ type: v as AirdropChecker["type"] })} options={TYPES} />
      </Field>
      <p className="text-[12px] text-muted">{HELP[c.type ?? "page"].replace("{runs}", alertRunsLabel())}</p>
      {c.type === "manual" ? null : c.type === "page" ? (
        <>
          <Field label="Claim or checker page"><Input className="num" value={c.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://claim.project.xyz" /></Field>
          <Field label="Text that means it's open (optional)" hint="Case-insensitive. Leave empty to alert as soon as the page loads."><Input value={c.match ?? ""} onChange={(e) => set({ match: e.target.value })} placeholder="Claim now" /></Field>
        </>
      ) : c.type === "contract" ? (
        <>
          <Field label="Chain">
            <NativeSelect value={c.chain ?? "ethereum"} onChange={(v) => set({ chain: v })} options={EVM_CHAINS.map((x) => ({ id: x.key, label: x.name }))} />
          </Field>
          <Field label="Contract address"><Input className="num" value={c.address ?? ""} onChange={(e) => set({ address: e.target.value, chain: c.chain ?? "ethereum" })} placeholder="0x…" /></Field>
          <Field label="View function"><Input className="num" value={c.fn ?? ""} onChange={(e) => set({ fn: e.target.value, chain: c.chain ?? "ethereum" })} placeholder="claimable(address) returns (uint256)" /></Field>
        </>
      ) : (
        <>
          <Field label={c.type === "merkle" ? "Claims JSON URL" : "Checker URL"}><Input className="num" value={c.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder={c.type === "merkle" ? "https://…/claims.json" : "https://api.project.xyz/eligibility/{address}"} /></Field>
          <Field label="Field path (optional)"><Input className="num" value={c.path ?? ""} onChange={(e) => set({ path: e.target.value })} placeholder={c.type === "merkle" ? "claims" : "amount"} /></Field>
        </>
      )}
      {c.type !== "manual" && c.type !== "page" && <div className="grid grid-cols-2 gap-3">
        <Field label="Decimals (optional)"><Input className="num" inputMode="numeric" value={c.decimals ?? ""} onChange={(e) => set({ decimals: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="18" /></Field>
        <Field label="Claim page (optional)"><Input value={c.claimUrl ?? ""} onChange={(e) => set({ claimUrl: e.target.value })} placeholder="https://claim.project.xyz" /></Field>
      </div>}
      <Field label="Claim status">
        <NativeSelect value={c.claimStatus ?? "unknown"} onChange={(v) => set({ claimStatus: v as AirdropChecker["claimStatus"] })} options={CLAIM_STATUS_OPTS} />
      </Field>
      <div className="flex justify-between gap-2 pt-1">
        {initial ? <Button type="button" variant="danger" disabled={saving} onClick={() => save(true)}>Remove</Button> : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </form>
  );
}
