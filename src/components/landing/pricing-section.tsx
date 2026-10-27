import type { CSSProperties } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { ArrowChip, Ic } from "./icons";

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

export function PricingSection() {
  return (
        <section id="pricing" className="pad">
          <div className="head rv">
            <span className="eyebrow"><i />Simple &amp; transparent</span>
            <h2 className="h2">Plans for <span className="grad-text">every stage</span></h2>
            <p className="lead">Start free with enough credits to validate one idea end to end. Upgrade when you want more, cancel any time.</p>
          </div>
          <div className="plans">
            {PLANS.map((plan, i) => {
              const hot = "highlighted" in plan && plan.highlighted;
              return (
                <div key={plan.id} className={`card plan rv${hot ? " hot" : ""}`} style={v({ "--d": `${i * 0.12}s` })}>
                  <div className="top"><h3>{plan.name}</h3><span className="tag">{plan.tag}</span></div>
                  <p className="desc">{plan.description}</p>
                  <div className="price"><b>${plan.priceMonthly}</b><small>/ month</small></div>
                  <Link href="/signup" className={`btn ${hot ? "btn-light" : plan.priceMonthly === 0 ? "btn-ghost" : "btn-dark"}`} style={plan.priceMonthly === 0 ? { justifyContent: "center" } : undefined}>
                    {plan.priceMonthly === 0 ? plan.cta : "Start free, upgrade later"}
                    {plan.priceMonthly === 0 ? null : <ArrowChip />}
                  </Link>
                  <ul>
                    {plan.features.map((f) => (
                      <li key={f}><Ic id="check" />{f}</li>
                    ))}
                    {plan.excluded.map((f) => (
                      <li key={f} className="no"><Ic id="x" />{f}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
  );
}
