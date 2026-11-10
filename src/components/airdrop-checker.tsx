"use client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, ExternalLink, Play, ScanSearch, Settings2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { AirdropChecker } from "@/db/schema";
import { Button, Empty, Field, Input, NativeSelect, Pill } from "@/components/ui";
import { EVM_CHAINS } from "@/lib/chains";
import { cn } from "@/lib/cn";
import { api, keys } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { shortAddr } from "@/lib/format";

const TYPES = [
  { id: "api", label: "Checker API (JSON)" },
  { id: "contract", label: "Claim contract view" },
  { id: "merkle", label: "Merkle / claims list (JSON)" },
] as const;

const HELP: Record<string, string> = {
  api: "The project's public eligibility endpoint. Use {address} where the wallet goes. Path picks the field, e.g. amount or data.eligible.",
  contract: "A read-only view on the claim contract that takes one address, e.g. claimable(address) returns (uint256). Never signs or sends.",
  merkle: "Public JSON of claims: { \"0xabc…\": \"123\" } or [{ address, amount }]. Path optional, e.g. claims.",
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
        title="No checker configured"
        body="farmOS only shows eligibility from a real source: the project's checker API, its claim contract, or a published claims list."
        action={<Button onClick={() => setEditing(true)}><Settings2 className="h-3.5 w-3.5" /> Set up checker</Button>}
      />
    );

  const results = checker.lastRun?.results ?? [];
  const eligible = results.filter((r) => r.status === "eligible").length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2.5">
        <div className="min-w-0 text-[13px]">
          <div className="font-medium">{TYPES.find((t) => t.id === checker.type)?.label}</div>
          <div className="num truncate text-[12px] text-muted">{checker.type === "contract" ? `${checker.chain} · ${shortAddr(checker.address)} · ${checker.fn}` : checker.url}</div>
        </div>
        <div className="flex gap-2">
          {checker.claimUrl && <a href={checker.claimUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /> Claim page</Button></a>}
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Settings2 className="h-3.5 w-3.5" /> Edit</Button>
          <Button size="sm" variant="primary" disabled={running} onClick={run}><Play className="h-3.5 w-3.5" /> {running ? "Checking…" : "Check now"}</Button>
        </div>
      </div>
      <p className="text-[12px] text-muted">{wallets.length ? `Checks the ${wallets.length} wallet${wallets.length > 1 ? "s" : ""} tagged on this project.` : "No wallets tagged on this project, so all linked EVM wallets are checked."}</p>
      {checker.lastRun ? (
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
      )}
    </div>
  );
}

function CheckerForm({ projectId, initial, onDone }: { projectId: string; initial: AirdropChecker | null; onDone: () => void }) {
  const [c, setC] = useState<Partial<AirdropChecker>>(initial ?? { type: "api" });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<AirdropChecker>) => setC((x) => ({ ...x, ...p }));
  const save = async (clear = false) => {
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/checker`, { method: "PUT", body: { checker: clear ? null : { ...c, decimals: c.decimals === undefined || Number.isNaN(c.decimals) ? undefined : c.decimals } } });
      toast.success(clear ? "Checker removed" : "Checker saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="max-w-xl space-y-3 rounded-lg border border-line bg-panel p-4">
      <Field label="Source">
        <NativeSelect value={c.type ?? "api"} onChange={(v) => set({ type: v as AirdropChecker["type"] })} options={TYPES} />
      </Field>
      <p className="text-[12px] text-muted">{HELP[c.type ?? "api"]}</p>
      {c.type === "contract" ? (
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Decimals (optional)"><Input className="num" inputMode="numeric" value={c.decimals ?? ""} onChange={(e) => set({ decimals: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="18" /></Field>
        <Field label="Claim page (optional)"><Input value={c.claimUrl ?? ""} onChange={(e) => set({ claimUrl: e.target.value })} placeholder="https://claim.project.xyz" /></Field>
      </div>
      <div className="flex justify-between gap-2 pt-1">
        {initial ? <Button type="button" variant="danger" disabled={saving} onClick={() => save(true)}>Remove</Button> : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save checker"}</Button>
        </div>
      </div>
    </form>
  );
}
