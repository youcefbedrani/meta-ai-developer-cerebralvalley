import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { Section } from "@/components/admin/ui";
import { getIntegrationStatus, INTEGRATIONS, type IntegrationName } from "@/lib/env";
import { isMarketplaceEnabled, paymentsMode } from "@/server/marketplace/config";
import { getPlatformSettings } from "@/server/platform/settings";

export const metadata: Metadata = { title: "Settings · Admin" };


export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings();
  let payments = "not configured";
  try {
    payments = paymentsMode() === "mock" ? "mock (test mode, no real money)" : "Stripe";
  } catch {}
  return (
    <div className="space-y-6">
      <PageHeader title="Platform settings" description="Turn parts of Startum on and off, run maintenance, broadcast a message, and set credits and marketplace fees. Changes apply within a few seconds and are written to the audit log." />
      <Section title="Controls">
        <SettingsForm initial={settings} section="platform" />
      </Section>
      <Section title="Server configuration" description="Read-only. These come from environment variables and need a restart to change.">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {(Object.keys(INTEGRATIONS) as IntegrationName[]).map((k) => {
            const s = getIntegrationStatus(k);
            return (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{INTEGRATIONS[k].label}</dt>
                <dd>{s.configured ? "configured" : `missing: ${s.missing.join(", ")}`}</dd>
              </div>
            );
          })}
          <dt className="text-muted-foreground">Marketplace deployed</dt>
          <dd>{isMarketplaceEnabled() ? "yes (MARKETPLACE_ENABLED)" : "no — set MARKETPLACE_ENABLED=true to deploy it"}</dd>
          <dt className="text-muted-foreground">Marketplace payments</dt>
          <dd>{payments}</dd>
        </dl>
      </Section>
    </div>
  );
}
