import type { Metadata } from "next";
import { MarketingPage } from "@/components/landing/marketing-page";
import { PricingSection } from "@/components/landing/pricing-section";
import { CREDIT_COSTS, MONTHLY_CREDITS, PLANS } from "@/lib/plans";
import "../landing.css";

export const metadata: Metadata = { title: "Pricing" };

const OPERATIONS: { key: keyof typeof CREDIT_COSTS; label: string }[] = [
  { key: "idea_generation", label: "Generate a batch of ideas" },
  { key: "research_job", label: "Sourced research job + validation report" },
  { key: "interview_script", label: "Interview script" },
  { key: "interview_analysis", label: "Interview notes analysis" },
  { key: "landing_copy", label: "Landing page copy draft" },
  { key: "business_model", label: "Business model & pricing" },
  { key: "mvp_plan", label: "MVP plan & build kit" },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <PricingSection />
      <section className="pad" style={{ background: "var(--bg-soft)" }}>
        <div className="head rv">
          <span className="eyebrow"><i />AI credits</span>
          <h2 className="h2">What credits buy</h2>
          <p className="lead">Credits are reserved before an AI action and refunded automatically if it fails. Monthly credits reset each calendar month.</p>
        </div>
        <div className="card rv" style={{ maxWidth: 760, margin: "0 auto", padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "var(--bg-soft)", textAlign: "left" }}>
                <th style={{ padding: "14px 20px" }}>Action</th>
                <th style={{ padding: "14px 20px", textAlign: "right" }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONS.map((o) => (
                <tr key={o.key} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "12px 20px", color: "var(--ink-2)" }}>{o.label}</td>
                  <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600 }}>{CREDIT_COSTS[o.key]}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid var(--line)", background: "var(--bg-soft)" }}>
                <td style={{ padding: "12px 20px" }}>Monthly credits</td>
                <td style={{ padding: "12px 20px", textAlign: "right" }}>{PLANS.map((p) => `${p.name} ${MONTHLY_CREDITS[p.id]}`).join(" · ")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </MarketingPage>
  );
}
