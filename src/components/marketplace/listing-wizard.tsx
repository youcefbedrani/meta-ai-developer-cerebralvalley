"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { createListingAction } from "@/app/(app)/app/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEVEL_INFO, type ValidationLevel } from "@/lib/marketplace/validation-level";
import { ASSET_LABELS, EXTERNAL_ASSETS, IN_PLATFORM_ASSETS, type AssetKind } from "@/lib/validation/marketplace";
import { cn } from "@/lib/utils";
import { LevelBadge } from "./shared";
import { useRun } from "./use-run";

type Project = { id: string; name: string; level: ValidationLevel; listed: boolean };
type Idea = { id: string; title: string; oneLiner: string; listed: boolean; fromProject: string | null };

export function ListingWizard({ projects, ideas }: { projects: Project[]; ideas: Idea[] }) {
  const { run, pending, router } = useRun();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"idea" | "project">(ideas.some((i) => !i.listed) || !projects.length ? "idea" : "project");
  const [ideaId, setIdeaId] = useState(ideas.find((i) => !i.listed)?.id ?? "");
  const [projectId, setProjectId] = useState(projects.find((p) => !p.listed && p.level !== "none")?.id ?? "");
  const [pub, setPub] = useState({ niche: "", earningMin: "", earningMax: "", earningBasis: "" });
  const [license, setLicense] = useState<"exclusive_transfer" | "non_exclusive">("exclusive_transfer");
  const [assets, setAssets] = useState<AssetKind[]>(["research_reports", "pain_quotes", "competitors", "experiments"]);
  const [ext, setExt] = useState<Record<string, string>>({});
  const [nonCompete, setNonCompete] = useState({ months: "12", scope: "" });
  const [price, setPrice] = useState({ type: "offers" as "fixed" | "offers", price: "", min: "", max: "", currency: "usd" });
  const exclusive = license === "exclusive_transfer";
  const isIdea = kind === "idea";
  const STEPS = isIdea ? (["What", "License", "Price & potential"] as const) : (["What", "Assets", "License", "Price & potential"] as const);
  const current = STEPS[step];
  const project = projects.find((p) => p.id === projectId);
  const idea = ideas.find((i) => i.id === ideaId);
  const toggle = (k: AssetKind) => setAssets((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const selected = exclusive ? [...new Set([...IN_PLATFORM_ASSETS, ...assets.filter((a) => (EXTERNAL_ASSETS as readonly string[]).includes(a))])] : assets.filter((a) => (IN_PLATFORM_ASSETS as readonly string[]).includes(a));

  const pickedOk = isIdea ? !!idea && !idea.listed : !!project && project.level !== "none" && !project.listed;
  const priceOk = !!price.price && pub.niche.trim().length >= 3 && Number(pub.earningMax) > 0 && Number(pub.earningMin || 0) <= Number(pub.earningMax) && pub.earningBasis.trim().length >= 20;
  const canNext = current === "What" ? pickedOk : current === "Assets" ? selected.length > 0 : current === "License" ? true : priceOk;
  // Tell the seller exactly what's missing instead of a silently disabled button.
  const missing =
    current === "What"
      ? pickedOk
        ? []
        : [isIdea ? (ideas.length ? "Pick an idea that isn't listed yet." : "Save an idea first (Discover Ideas or Gold Mine).") : projects.some((p) => !p.listed && p.level !== "none") ? "Pick a project." : "None of your projects can be sold yet: run “Validate my idea” on a project first."]
      : current === "Assets"
        ? selected.length ? [] : ["Include at least one asset."]
        : current === "Price & potential"
          ? [
              pub.niche.trim().length < 3 && "Add a niche (at least 3 characters).",
              !(Number(pub.earningMax) > 0) && "Add a high earning estimate.",
              Number(pub.earningMin || 0) > Number(pub.earningMax) && Number(pub.earningMax) > 0 && "The low estimate can't be above the high one.",
              pub.earningBasis.trim().length < 20 && `Explain how you estimated it (${pub.earningBasis.trim().length}/20 characters).`,
              !price.price && "Set a price.",
            ].filter((m): m is string => !!m)
          : [];

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1", i === step ? "border-[var(--violet)] bg-[var(--violet)]/10" : i < step ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-white text-muted-foreground")}>
            {i < step ? <Check className="size-3.5" /> : <span>{i + 1}.</span>} {s}
          </li>
        ))}
      </ol>

      <section className="surface p-6">
        {current === "What" ? (
          <div className="space-y-4">
            <fieldset>
              <legend className="font-medium">What are you selling?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([["idea", "An idea or sub-idea", "One saved idea, or one angle/niche of a bigger idea. Buyers get the full write-up."], ["project", "A full project", "Research, evidence, experiments and assets from a project you validated."]] as const).map(([k, label, hint]) => (
                  <label key={k} className={cn("cursor-pointer rounded-xl border p-4 text-sm", kind === k ? "border-[var(--violet)] bg-[var(--violet)]/5" : "border-border bg-white")}>
                    <span className="flex items-center gap-2 font-medium"><input type="radio" name="kind" checked={kind === k} onChange={() => { setKind(k); setStep(0); }} /> {label}</span>
                    <span className="mt-1 block text-muted-foreground">{hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {isIdea ? (
              <fieldset className="space-y-2">
                <legend className="font-medium">Which idea?</legend>
                <div className="grid gap-2">
                  {ideas.map((i) => (
                    <label key={i.id} className={cn("flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 text-sm", ideaId === i.id ? "border-[var(--violet)] bg-[var(--violet)]/5" : "border-border bg-white", i.listed && "cursor-not-allowed opacity-60")}>
                      <span className="flex items-start gap-2">
                        <input type="radio" name="idea" value={i.id} checked={ideaId === i.id} disabled={i.listed} onChange={() => setIdeaId(i.id)} className="mt-1" />
                        <span><span className="font-medium">{i.title}</span><span className="block text-muted-foreground">{i.oneLiner}</span>{i.fromProject ? <span className="block text-xs text-muted-foreground">Part of “{i.fromProject}”</span> : null}</span>
                      </span>
                      {i.listed ? <span className="text-xs text-muted-foreground">Already listed</span> : null}
                    </label>
                  ))}
                  {!ideas.length ? <p className="text-sm text-muted-foreground">You don&apos;t have saved ideas yet. Generate some in Discover Ideas or Gold Mine.</p> : null}
                </div>
              </fieldset>
            ) : (
              <fieldset className="space-y-2">
                <legend className="font-medium">Which project?</legend>
                <p className="text-sm text-muted-foreground">Its validation level is computed from your tracked data. You need at least a completed research report with sources.</p>
                <div className="grid gap-2">
                  {projects.map((p) => (
                    <label key={p.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm", projectId === p.id ? "border-[var(--violet)] bg-[var(--violet)]/5" : "border-border bg-white", (p.listed || p.level === "none") && "cursor-not-allowed opacity-60")}>
                      <span className="flex items-center gap-2"><input type="radio" name="project" value={p.id} checked={projectId === p.id} disabled={p.listed || p.level === "none"} onChange={() => setProjectId(p.id)} /> {p.name}</span>
                      <span className="flex items-center gap-2">
                        {p.listed ? <span className="text-xs text-muted-foreground">Already listed</span> : null}
                        {!p.listed && p.level === "none" ? <a href={`/app/projects/${p.id}`} className="text-xs font-medium text-primary hover:underline">Validate it first →</a> : null}
                        <LevelBadge level={p.level} />
                      </span>
                    </label>
                  ))}
                  {!projects.length ? <p className="text-sm text-muted-foreground">You don&apos;t have any projects yet.</p> : null}
                </div>
              </fieldset>
            )}
          </div>
        ) : current === "Assets" ? (
          <div className="space-y-4">
            <p className="font-medium">What&apos;s included?</p>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">In-platform assets{exclusive ? " (all included: an exclusive transfer moves the whole project)" : ""}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {IN_PLATFORM_ASSETS.map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
                    <input type="checkbox" checked={exclusive || assets.includes(k)} disabled={exclusive} onChange={() => toggle(k)} /> {ASSET_LABELS[k]}
                  </label>
                ))}
              </div>
            </div>
            {exclusive ? (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">External assets (transferred with a checklist in the deal room)</p>
                <div className="mt-2 space-y-2">
                  {EXTERNAL_ASSETS.map((k) => (
                    <div key={k} className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assets.includes(k)} onChange={() => toggle(k)} /> {ASSET_LABELS[k]}</label>
                      {assets.includes(k) ? <Input aria-label={`${ASSET_LABELS[k]} details`} value={ext[k] ?? ""} onChange={(e) => setExt((x) => ({ ...x, [k]: e.target.value }))} placeholder="e.g. invoicebot.io (shown only after NDA)" className="h-9" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground">External assets (domain, repo, accounts) can only be sold with an exclusive transfer.</p>}
          </div>
        ) : current === "License" ? (
          <fieldset className="space-y-3">
            <legend className="font-medium">License type</legend>
            {(["exclusive_transfer", "non_exclusive"] as const).map((l) => (
              <label key={l} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 text-sm", license === l ? "border-[var(--violet)] bg-[var(--violet)]/5" : "border-border bg-white")}>
                <input type="radio" name="license" checked={license === l} onChange={() => setLicense(l)} className="mt-1" />
                <span>
                  <b>{l === "exclusive_transfer" ? "Exclusive transfer" : "Non-exclusive copy"}</b>
                  <span className="block text-muted-foreground">
                    {isIdea
                      ? l === "exclusive_transfer"
                        ? "The idea moves to the buyer's account and leaves yours. The listing closes. Only one buyer."
                        : "The buyer gets a copy. You keep the idea and can sell more copies. Clearly labelled."
                      : l === "exclusive_transfer"
                        ? "The project moves to the buyer's account, you lose access, the listing closes, and a non-compete applies."
                        : "The buyer gets a copy of the research package. You keep the project and can sell more copies. Clearly labelled."}
                  </span>
                </span>
              </label>
            ))}
            {exclusive && !isIdea ? (
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <div className="space-y-1"><Label htmlFor="nc-months">Non-compete (months)</Label><Input id="nc-months" inputMode="numeric" value={nonCompete.months} onChange={(e) => setNonCompete((n) => ({ ...n, months: e.target.value }))} /></div>
                <div className="space-y-1"><Label htmlFor="nc-scope">Non-compete scope</Label><Input id="nc-scope" value={nonCompete.scope} onChange={(e) => setNonCompete((n) => ({ ...n, scope: e.target.value }))} placeholder="e.g. invoice reminder tools for freelancers" /></div>
              </div>
            ) : null}
          </fieldset>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--violet)]/30 bg-[var(--violet)]/5 p-4">
              <p className="font-medium">What buyers see before they sign anything</p>
              <p className="text-sm text-muted-foreground">Only these three things are public: the niche, the price, and your earning estimate. Keep the niche general so you don&apos;t give the idea away.</p>
              <div className="mt-3 grid gap-3">
                <div className="space-y-1"><Label htmlFor="niche">Niche</Label><Input id="niche" value={pub.niche} onChange={(e) => setPub((p) => ({ ...p, niche: e.target.value }))} placeholder="e.g. Invoicing tools for freelancers" maxLength={80} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor="earn-min">Could make per month: low estimate</Label><Input id="earn-min" inputMode="decimal" value={pub.earningMin} onChange={(e) => setPub((p) => ({ ...p, earningMin: e.target.value }))} placeholder="e.g. 2000" /></div>
                  <div className="space-y-1"><Label htmlFor="earn-max">Could make per month: high estimate</Label><Input id="earn-max" inputMode="decimal" value={pub.earningMax} onChange={(e) => setPub((p) => ({ ...p, earningMax: e.target.value }))} placeholder="e.g. 8000" /></div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="earn-basis">How did you estimate it? (shown only to buyers with access)</Label>
                  <textarea id="earn-basis" rows={2} value={pub.earningBasis} onChange={(e) => setPub((p) => ({ ...p, earningBasis: e.target.value }))} placeholder="e.g. 200 customers × $20/month, based on competitor pricing of $15–29 and 40 waitlist signups" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" />
                </div>
                <p className="text-xs text-muted-foreground">Buyers see the estimate labelled “seller&apos;s estimate, not verified”. Be honest: misleading estimates get listings removed.</p>
              </div>
            </div>
            <fieldset className="flex gap-2">
              <legend className="mb-2 font-medium">Pricing</legend>
              {(["fixed", "offers"] as const).map((t) => (
                <label key={t} className={cn("cursor-pointer rounded-lg border px-3 py-2 text-sm", price.type === t ? "border-[var(--violet)] bg-[var(--violet)]/10" : "border-border bg-white")}>
                  <input type="radio" name="ptype" className="sr-only" checked={price.type === t} onChange={() => setPrice((p) => ({ ...p, type: t }))} /> {t === "fixed" ? "Fixed price" : "Accept offers"}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label htmlFor="price">{price.type === "fixed" ? "Price" : "Asking price"}</Label><Input id="price" inputMode="decimal" value={price.price} onChange={(e) => setPrice((p) => ({ ...p, price: e.target.value }))} /></div>
              {price.type === "offers" ? (
                <>
                  <div className="space-y-1"><Label htmlFor="min">Minimum offer</Label><Input id="min" inputMode="decimal" value={price.min} onChange={(e) => setPrice((p) => ({ ...p, min: e.target.value }))} placeholder="optional" /></div>
                  <div className="space-y-1"><Label htmlFor="max">Maximum offer</Label><Input id="max" inputMode="decimal" value={price.max} onChange={(e) => setPrice((p) => ({ ...p, max: e.target.value }))} placeholder="optional" /></div>
                </>
              ) : null}
              <div className="space-y-1"><Label htmlFor="cur">Currency</Label><Input id="cur" value={price.currency} onChange={(e) => setPrice((p) => ({ ...p, currency: e.target.value.toLowerCase().slice(0, 3) }))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">The platform fee is deducted from your payout. Funds are held until the buyer confirms the transfer.</p>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="gradient" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
        ) : (
          <Button
            variant="gradient"
            disabled={!canNext || pending}
            onClick={() =>
              run(
                () =>
                  createListingAction({
                    kind,
                    projectId: isIdea ? null : projectId,
                    ideaId: isIdea ? ideaId : null,
                    licenseType: license,
                    priceType: price.type,
                    price: price.price,
                    minPrice: price.min,
                    maxPrice: price.max,
                    currency: price.currency,
                    niche: pub.niche,
                    earningMin: pub.earningMin || 0,
                    earningMax: pub.earningMax,
                    earningBasis: pub.earningBasis,
                    assets: isIdea ? [] : selected,
                    externalDescriptions: ext,
                    nonCompeteMonths: isIdea ? 0 : nonCompete.months,
                    nonCompeteScope: nonCompete.scope,
                  }),
                isIdea ? "Draft created. Check the details, then submit for review." : "Draft created. Now write the details for buyers.",
                (d) => router.push(`/app/marketplace/sell/${d.id}`),
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null} Create draft
          </Button>
        )}
      </div>
      {missing.length ? (
        <ul className="space-y-0.5 text-right text-xs text-muted-foreground" aria-live="polite">
          {missing.map((m) => <li key={m}>{m}</li>)}
        </ul>
      ) : null}
      {!isIdea && project ? <p className="text-xs text-muted-foreground">Level: {LEVEL_INFO[project.level].label}. {LEVEL_INFO[project.level].description}</p> : null}
    </div>
  );
}
