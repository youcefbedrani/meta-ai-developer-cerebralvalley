import type { CSSProperties } from "react";
import Link from "next/link";
import { LandingEffects } from "@/components/landing/landing-effects";
import { MistakesStory } from "@/components/landing/mistakes-story";
import { MarketingFooter, MarketingHeader } from "@/components/landing/marketing-chrome";
import { PricingSection } from "@/components/landing/pricing-section";
import { ArrowChip, Example, Ic, IconSprite, LogoGlyph } from "@/components/landing/icons";
import "./landing.css";

/*
 * Public landing page, ported from the static design in
 * stitch_ai_saas_validation_platform_landing_page/stratum_ai_saas_discovery_market_validation_platform/index.html.
 * Trust rules apply here too: product screens are labelled "Example", and there are
 * no invented testimonials, customer logos, metrics or live activity.
 */

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

const STAGES = ["Discover", "Research", "Validate", "Plan", "Brand", "Launch", "Grow"];

const STEPS = [
  { title: "Discover ideas that fit you", text: "Ideas matched to your skills, budget, time and goals — with the problem, customer and first experiment spelled out." },
  { title: "Research with real sources", text: "Searches the web, reads the pages and stores every source. Facts link to them; everything else is labelled." },
  { title: "Map the competition", text: "Direct, indirect and alternative solutions. Pricing appears only when it was actually found in a source." },
  { title: "Validate with experiments", text: "Interviews, landing pages, waitlists and pre-sales with success criteria you set before you start." },
  { title: "Plan a lean MVP", text: "Must-haves, later items, user journeys and milestones sized for a micro-SaaS — exportable for coding agents." },
  { title: "Decide: Build, Pivot or Drop", text: "Your recorded results drive the decision. A positive AI report never counts as validation." },
];

const PRINCIPLES = [
  { kind: "FACT", color: "#0f8a52", bg: "#18b26b14", title: "Facts link to stored sources", text: "Every factual claim in a report references a source we saved: URL, title and retrieval date. No source, no fact." },
  { kind: "ANALYSIS", color: "#814bee", bg: "#814bee14", title: "Interpretation is labelled", text: "When the AI interprets evidence, it says so. You always know which sentences are reasoning rather than findings." },
  { kind: "ASSUMPTION", color: "#d24f4f", bg: "#f7737316", title: "Assumptions become tests", text: "Anything unproven is marked as an assumption and turned into an experiment you can run." },
  { kind: "NOT FOUND", color: "#8a5a00", bg: "#f5a52414", title: "Gaps are shown, not filled", text: "If competitor pricing or market data can't be found, the report says “needs research” instead of inventing a number." },
  { kind: "VALIDATED", color: "#41175e", bg: "#41175e12", title: "Only experiments validate", text: "An idea is validated by results you record — never by a confident report. We don't predict success probabilities." },
  { kind: "PRIVATE", color: "#41175e", bg: "#f4f1f5", title: "Your ideas stay yours", text: "Every query is scoped to your account, and your workspace is never used to train shared models." },
];

const FAQ = [
  {
    q: "How does it find and verify sources?",
    a: "Research jobs run web searches, read the result pages and store every source with its URL, title and retrieval date. A report statement can only be labelled FACT if it references one of those stored sources; otherwise it's ANALYSIS, ASSUMPTION, or marked “needs research”.",
  },
  {
    q: "Can it tell me whether my idea will succeed?",
    a: "No, and we won't pretend to. Reports give four separate ratings — demand evidence, competitive pressure, feasibility and monetization — each with a short justification. Only real experiment results validate an idea.",
  },
  {
    q: "Are my project ideas private?",
    a: "Yes. Every database query is scoped to your account, and your workspace is never used to train shared AI models.",
  },
  {
    q: "What happens in the Validation Lab?",
    a: "You design experiments — interviews, surveys, landing pages, waitlists, demo requests, outreach and pre-sales — each with a hypothesis and success criteria. You record the results, capture learnings, and make a Build, Pivot or Drop decision.",
  },
  {
    q: "Is everything available today?",
    a: "Not yet. Accounts, your founder profile and the projects workspace work now. The Idea Finder, research engine, Validation Lab and MVP planner are rolling out next, and the app marks anything unfinished as “Soon”.",
  },
  {
    q: "What does it cost?",
    a: "Everything is free during early access. Paid plans add more AI credits and validation tools once billing launches — you'll never be charged unless you choose a plan.",
  },
];

export default function HomePage() {
  return (
    <div className="landing" id="landing">
      <IconSprite />

      <MarketingHeader />

      <main className="frame">
        {/* ================= HERO ================= */}
        <section className="hero">
          <div className="rails" />
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="pill rv" style={v({ "--d": ".05s" })}>
                <span className="new">Meta Hackathon</span> Evidence-first idea validation on Muse Spark
              </span>
              <h1>
                <span className="line">
                  {"Find your next SaaS idea.".split(" ").map((w, i) => (
                    <span key={i}>
                      <span className="word" style={{ transitionDelay: `${0.12 + i * 0.07}s` }}>{w}</span>{" "}
                    </span>
                  ))}
                </span>
                <span className="line">
                  {"Validate it before you build.".split(" ").map((w, i) => (
                    <span key={i}>
                      <span className="word grad-text" style={{ transitionDelay: `${0.34 + i * 0.07}s` }}>{w}</span>{" "}
                    </span>
                  ))}
                </span>
              </h1>
              <p className="sub rv" style={v({ "--d": ".55s" })}>
                Discover opportunities that fit you, research competitors with cited sources, and test real customer demand — in one AI workspace built for founders.
              </p>
              <div className="hero-actions rv" style={v({ "--d": ".7s" })}>
                <Link href="/signup" className="btn btn-dark">
                  Start validating free
                  <ArrowChip />
                </Link>
                <a href="#how" className="btn btn-ghost">
                  <Ic id="play" />
                  See how it works
                </a>
              </div>
              <div className="ticks rv" style={v({ "--d": ".85s" })}>
                {["Every claim cited", "Competitor research", "Real validation experiments"].map((t) => (
                  <span key={t}>
                    <i className="ok">
                      <Ic id="check" />
                    </i>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Isometric product scene (illustrative example data) */}
            <div className="scene rv-scale" style={v({ "--d": ".3s" })} id="scene" aria-hidden="true">
              <div className="tilt" id="tilt">
                <div className="plane">
                  <div className="floor" />
                  <svg className="path" viewBox="0 0 440 440">
                    <path d="M70 345 C 70 300, 120 300, 140 290" />
                    <path d="M380 70 C 420 120, 400 200, 352 210" />
                  </svg>

                  <div className="p3 iso-card c-main" style={{ transform: "translateZ(14px)" }}>
                    <div className="url">
                      <i />
                      <i />
                      <i />
                      &nbsp;example project
                    </div>
                    <div className="ttl">
                      <div>
                        <h4>B2B Data Sync</h4>
                        <small>Postgres ⇄ CRM · mid-market RevOps</small>
                      </div>
                      <span className="tag v">12 sources</span>
                    </div>
                    <div className="minis">
                      <div className="mini">
                        <span>Demand evidence</span>
                        <b>Strong</b>
                        <div className="bar">
                          <i style={{ width: "85%" }} />
                        </div>
                      </div>
                      <div className="mini">
                        <span>Feasibility</span>
                        <b>High</b>
                        <div className="bar">
                          <i style={{ width: "75%" }} />
                        </div>
                      </div>
                      <div className="mini">
                        <span>Competition</span>
                        <b>Medium</b>
                      </div>
                      <div className="mini">
                        <span>Monetization</span>
                        <b>To test</b>
                      </div>
                    </div>
                  </div>

                  <div className="p3 float" style={v({ left: "210px", top: "278px", "--z": "64px", "--fd": "-1.5s" })}>
                    <div className="iso-card c-cite" style={{ position: "static" }}>
                      <div className="src">
                        <em>r/</em>Example citation
                        <span className="tag g" style={{ marginLeft: "auto", fontSize: 9, padding: "2px 6px" }}>
                          FACT
                        </span>
                      </div>
                      <p>“We spend hours every week manually matching fields between our CRM and Postgres.”</p>
                      <small style={{ fontSize: 9, color: "var(--muted)" }}>source URL + retrieval date stored</small>
                    </div>
                  </div>

                  <div className="p3 float" style={v({ left: "-120px", top: "330px", "--z": "10px", "--fd": "-3s" })}>
                    <div className="p3 cube">
                      <div className="glow" />
                      <div className="f" />
                      <div className="f n" />
                      <div className="f s" />
                      <div className="f e" />
                      <div className="f w" />
                      <div className="f top">
                        <LogoGlyph size={34} />
                      </div>
                    </div>
                  </div>

                  <div className="p3 float" style={v({ left: "350px", top: "20px", "--z": "40px", "--fd": "-.8s" })}>
                    <div className="puck grad">
                      <Ic id="spark" style={{ width: 24, height: 24 }} />
                    </div>
                  </div>
                  <div className="p3 float" style={v({ left: "300px", top: "-40px", "--z": "90px", "--fd": "-4s" })}>
                    <div className="puck" />
                  </div>
                  <div className="p3 float" style={v({ left: "150px", top: "-14px", "--z": "46px", "--fd": "-2.2s" })}>
                    <span className="c-chip">
                      <i className="dot" style={{ background: "#d24f4f", boxShadow: "0 0 0 3px #f7737322" }} />
                      ASSUMPTION · to test
                    </span>
                  </div>
                  <div className="p3 float" style={v({ left: "-150px", top: "110px", "--z": "56px", "--fd": "-5s" })}>
                    <span className="c-chip">
                      <Ic id="link" style={{ width: 13, height: 13, color: "var(--violet)" }} />
                      Every claim cited
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* stage marquee (replaces customer logos — we don't show logos we haven't earned) */}
          <div className="trust">
            <div className="lbl rv">
              <i />
              One workspace, from first idea to launched product
            </div>
            <div className="marquee rv" style={v({ "--d": ".1s" })}>
              <div className="stage-track">
                {[...STAGES, ...STAGES].map((s, i) => (
                  <span key={i} className="stage-chip" aria-hidden={i >= STAGES.length}>
                    <i />
                    {s}
                    <b>0{(i % STAGES.length) + 1}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= MISTAKES WE FIX (scroll story) ================= */}
        <MistakesStory />

        {/* ================= FEATURE TRIO ================= */}
        <section id="features">
          <div className="trio">
            <div className="rv">
              <h3>Ideas that fit you</h3>
              <p>Your skills, budget, time and goals shape every suggestion — each with a problem, a customer and a first experiment.</p>
              <div className="viz">
                <Example label="Illustration" />
                <div className="dots" />
                <svg className="links" viewBox="0 0 300 250" preserveAspectRatio="none">
                  <path d="M150 125 L60 50" />
                  <path d="M150 125 L240 46" />
                  <path d="M150 125 L48 190" />
                  <path d="M150 125 L250 196" />
                  <path d="M150 125 L150 222" />
                </svg>
                <div className="node" style={v({ left: "9%", top: "13%", "--r": "-6deg" })}>Your skills</div>
                <div className="node" style={v({ right: "7%", top: "18%", "--r": "5deg", "--bd": "-1s" })}>Budget</div>
                <div className="node" style={v({ left: "5%", bottom: "16%", "--r": "4deg", "--bd": "-2s" })}>Time</div>
                <div className="node" style={v({ right: "6%", bottom: "14%", "--r": "-5deg", "--bd": "-3s" })}>Goals</div>
                <div className="node" style={{ left: "50%", bottom: "4%", translate: "-50% 0", animation: "none" }}>
                  <b className="grad-text">Idea + first experiment</b>
                </div>
                <div className="node-c">
                  <LogoGlyph size={30} />
                </div>
              </div>
            </div>
            <div className="rv" style={v({ "--d": ".12s" })}>
              <h3>Cited market proof</h3>
              <p>Every statement is labelled FACT, ANALYSIS or ASSUMPTION. Facts link to the source they came from.</p>
              <div className="viz">
                <Example label="Illustration" />
                <div className="dots" />
                <div className="stack" id="citeStack">
                  <div className="cite">
                    <div className="src"><em style={{ background: "#ff5a1f" }}>r/</em>Forum thread<small>source stored</small></div>
                    <p>“Matching custom fields between our CRM and database takes hours every week.”</p>
                    <div className="meta"><span>Quoted from a stored source</span><span className="tag g">FACT</span></div>
                  </div>
                  <div className="cite">
                    <div className="src"><em style={{ background: "#ff492c" }}>★</em>Review site<small>source stored</small></div>
                    <p>“The pricing jumps sharply once you need more than a few connectors.”</p>
                    <div className="meta"><span>Quoted from a stored source</span><span className="tag g">FACT</span></div>
                  </div>
                  <div className="cite">
                    <div className="src"><em style={{ background: "#814bee" }}>AI</em>Interpretation</div>
                    <p>Smaller teams may be underserved by current pricing tiers.</p>
                    <div className="meta"><span>Based on 2 facts above</span><span className="tag v">ANALYSIS</span></div>
                  </div>
                  <div className="cite">
                    <div className="src"><em style={{ background: "#d24f4f" }}>?</em>Hypothesis</div>
                    <p>Teams would pay a monthly fee for a self-serve sync tool.</p>
                    <div className="meta"><span>Needs an experiment</span><span className="tag c">ASSUMPTION</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rv" style={v({ "--d": ".24s" })}>
              <h3>Competitor map</h3>
              <p>Direct, indirect and alternative solutions with strengths and weaknesses — and prices only when found.</p>
              <div className="viz">
                <Example label="Illustration" />
                <div className="matrix">
                  <div className="zone" />
                  <div className="pt" style={{ left: "18%", top: "28%" }}><i />Competitor A</div>
                  <div className="pt" style={{ left: "30%", top: "68%" }}><i />Competitor B</div>
                  <div className="pt" style={{ left: "66%", top: "78%" }}><i />Spreadsheet</div>
                  <div className="pt" style={{ left: "14%", top: "86%" }}><i />Agency</div>
                  <div className="pt you" style={{ left: "74%", top: "24%" }}><i />Your gap?</div>
                </div>
                <span className="axis" style={{ left: 34, bottom: 10 }}>Price →</span>
                <span className="axis" style={{ left: 8, top: 22, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Fit →</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= GOLD MINE ================= */}
        <section id="gold-mine" className="pad" style={{ background: "var(--bg-soft)" }}>
          <div className="head rv">
            <span className="eyebrow"><i />Gold Mine</span>
            <h2 className="h2">Find opportunities in what<br /><span className="grad-text">customers already complain about</span></h2>
            <p className="lead">No idea yet? Explore the market map. Have one? Skip straight to the evidence. Either way, every idea traces back to real public discussions.</p>
          </div>
          <div className="gm-steps rv">
            {[
              ["Market", "Drill down from Health, Wealth or Relationships to a specific niche."],
              ["Demand", "Real search volume and multi-year trends, classified by fixed rules."],
              ["Pains", "Short verbatim quotes from recent, active discussions — each with its link and date."],
              ["Ideas", "Ideas generated only from ranked pain clusters. No link to a pain, no idea."],
              ["Landing page", "Waitlist copy written from customers' own words, ready to test."],
            ].map(([t, d], i) => (
              <div key={t} className="card gm-step">
                <b>0{i + 1}</b>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="gm-demo rv-scale">
            <Example label="Illustration" />
            <div className="gm-quote">
              <p>“I wish there was a simple tool that just did this without a 3 hour setup.”</p>
              <span>Discussion thread · community · date · <u>source link stored</u></span>
            </div>
            <div className="gm-arrow">→</div>
            <div className="gm-cluster">
              <small>Pain cluster · ranked by frequency, intensity, recency</small>
              <b>Setup takes too long for small teams</b>
              <span className="tag v">Based on real quotes</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
            <Link href="/signup" className="btn btn-dark">Start mining<ArrowChip /></Link>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how" className="pad">
          <div className="how">
            <div>
              <div className="head left rv" style={{ marginBottom: 36 }}>
                <span className="eyebrow"><i />How it works</span>
                <h2 className="h2">From vague idea to <span className="grad-text">tested plan</span></h2>
                <p className="lead">Six steps, one project. Every step reuses what you learned in the previous one, so your pricing, plan and pitch never contradict your research.</p>
              </div>
              <div className="steps rv" style={v({ "--d": ".1s" })} id="steps">
                {STEPS.map((s, i) => (
                  <button key={s.title} type="button" className={`step${i === 0 ? " on" : ""}`}>
                    <span className="n">0{i + 1}</span>
                    <h4>{s.title}</h4>
                    <p>{s.text}</p>
                    <i className="prog" />
                  </button>
                ))}
              </div>
            </div>

            <div className="stage rv-scale" style={v({ "--d": ".15s" })}>
              <div className="dots" />
              <Example />
              {/* 1 Ideas */}
              <div className="screen on"><div className="win">
                <div className="win-h"><b>Ideas for your profile</b><span className="tag">3 generated</span></div>
                <div className="row"><div className="grow">CRM ⇄ database field sync for RevOps<div className="hbar"><i style={v({ "--w": "80%" })} /></div></div><span className="tag g">Fits skills</span></div>
                <div className="row"><div className="grow">Invoice reminders for freelancers<div className="hbar"><i style={v({ "--w": "62%" })} /></div></div><span className="tag">Fits budget</span></div>
                <div className="row"><div className="grow">Uptime digest for agencies<div className="hbar"><i style={v({ "--w": "48%" })} /></div></div><span className="tag">Fits time</span></div>
              </div></div>
              {/* 2 Research */}
              <div className="screen"><div className="win">
                <div className="win-h"><b>Research · sources</b><span className="tag v">every fact linked</span></div>
                <div className="row"><span className="tag g">FACT</span><span className="grow">Teams describe manual field mapping weekly</span><Ic id="link" style={{ width: 14, color: "var(--muted)" }} /></div>
                <div className="row"><span className="tag g">FACT</span><span className="grow">Reviews mention steep connector pricing</span><Ic id="link" style={{ width: 14, color: "var(--muted)" }} /></div>
                <div className="row"><span className="tag v">ANALYSIS</span><span className="grow">Small teams may be underserved</span></div>
                <div className="row"><span className="tag c">ASSUMPTION</span><span className="grow">Will pay monthly for self-serve sync</span></div>
              </div></div>
              {/* 3 Competitors */}
              <div className="screen"><div className="win">
                <div className="win-h"><b>Competitors</b><span className="tag">4 found</span></div>
                <div className="row"><span className="grow"><b>Competitor A</b> · direct</span><span className="tag g">pricing sourced</span></div>
                <div className="row"><span className="grow"><b>Competitor B</b> · direct</span><span className="tag g">pricing sourced</span></div>
                <div className="row"><span className="grow"><b>Spreadsheets</b> · alternative</span><span className="tag">free</span></div>
                <div className="row"><span className="grow"><b>Competitor C</b> · indirect</span><span className="tag c">pricing not found</span></div>
              </div></div>
              {/* 4 Validate */}
              <div className="screen"><div className="win">
                <div className="win-h"><b>Landing page experiment</b><span className="tag">yourapp.example/p/sync</span></div>
                <div className="lp">
                  <h5>CRM ⇄ Postgres sync in minutes</h5>
                  <p>Real-time two-way sync for small RevOps teams.</p>
                  <div className="form"><span>you@company.com</span><em>Join waitlist</em></div>
                </div>
                <div className="row" style={{ marginTop: 10 }}><span className="grow">Success criteria</span><b>≥ 5% visitor signups</b></div>
              </div></div>
              {/* 5 Plan */}
              <div className="screen"><div className="win gantt">
                <div className="win-h"><b>MVP plan</b><span className="tag c">2 items moved to “later”</span></div>
                <div className="g"><span>Auth + workspace</span><div><i style={v({ "--l": "0%", "--w": "22%" })} /></div></div>
                <div className="g"><span>DB connector</span><div><i style={v({ "--l": "18%", "--w": "30%" })} /></div></div>
                <div className="g"><span>CRM writeback</span><div><i style={v({ "--l": "40%", "--w": "30%" })} /></div></div>
                <div className="g"><span>Billing</span><div><i style={v({ "--l": "66%", "--w": "18%" })} /></div></div>
                <div className="ceil">Feature freeze · launch checklist</div>
              </div></div>
              {/* 6 Decide */}
              <div className="screen"><div className="win">
                <div className="win-h"><b>Experiment results · recorded by you</b><span className="tag">decision pending</span></div>
                <div className="row"><span className="tag g">PASSED</span><span className="grow">Interviews: problem confirmed by most</span></div>
                <div className="row"><span className="tag g">PASSED</span><span className="grow">Waitlist signups above target</span></div>
                <div className="row"><span className="tag c">MISSED</span><span className="grow">Pre-sale: below target</span></div>
                <div className="row" style={{ justifyContent: "center", gap: 8, paddingTop: 14 }}>
                  <span className="tag">Build</span><span className="tag v">Pivot pricing</span><span className="tag">Drop</span>
                </div>
              </div></div>
            </div>
          </div>
        </section>

        {/* ================= WORKSPACE ================= */}
        <section className="pad" style={{ background: "var(--bg-soft)" }}>
          <div className="head rv">
            <span className="eyebrow"><i />Project workspace</span>
            <h2 className="h2">Everything you need<br /><span className="soft">before writing a line of code</span></h2>
            <p className="lead">Research, competitors, personas and experiments live in one project, so every later step builds on the same evidence.</p>
          </div>

          <div className="card dossier rv-scale">
            <div className="dossier-h">
              <div><small>Example project dossier</small><b>B2B Data Sync</b></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="tag">Decision pending · 2 experiments running</span>
                <span className="tag"><Ic id="file" style={{ width: 12, height: 12 }} />Markdown export</span>
              </div>
            </div>
            <div className="dossier-b">
              <div>
                <h5><Ic id="user" />Target customer</h5>
                <p>Technical RevOps leads at small B2B companies running Postgres and a CRM.</p>
                <div className="kv"><span>Main pain</span><b>Manual field mapping</b></div>
                <div className="kv"><span>Evidence</span><b>3 facts · 1 assumption</b></div>
              </div>
              <div>
                <h5><Ic id="warn" />Risks</h5>
                <div className="risk"><b>Security hesitancy</b>Test: offer a self-hosted agent in interviews.</div>
                <div className="risk"><b>API rate limits</b>Test: prototype against sandbox limits.</div>
              </div>
              <div>
                <h5><Ic id="list" />Next actions</h5>
                <div id="todos">
                  <div className="todo"><i><Ic id="check" /></i><span>Interview 10 RevOps leads</span></div>
                  <div className="todo"><i><Ic id="check" /></i><span>Publish the waitlist landing page</span></div>
                  <div className="todo"><i><Ic id="check" /></i><span>Run a pre-sale with 3 pricing options</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="three">
            <div className="card feat rv">
              <span className="ico"><Ic id="file" /></span>
              <h3>Structured reports</h3>
              <p>Validation reports with executive summary, demand evidence, competitors, risks and recommended experiments.</p>
              <div className="mini-viz">
                <Example label="Illustration" />
                <div className="pages"><i /><i /><i><s /><s /><s /><s style={{ width: "70%" }} /><s /><s style={{ width: "40%" }} /></i></div>
              </div>
            </div>
            <div className="card feat rv" style={v({ "--d": ".12s" })}>
              <span className="ico"><Ic id="flask" /></span>
              <h3>Validation Lab</h3>
              <p>Landing pages and waitlists hosted for you, counting real visits and signups toward your experiment.</p>
              <div className="mini-viz">
                <Example label="Illustration" />
                <div className="ab">
                  <div><span className="col" style={v({ "--h": "44px" })} /><span>Variant A</span><b>Target 5%</b></div>
                  <div><span className="col win-col" style={v({ "--h": "92px" })} /><span>Variant B</span><b className="grad-text">Your result</b></div>
                </div>
              </div>
            </div>
            <div className="card feat rv" style={v({ "--d": ".24s" })}>
              <span className="ico"><Ic id="scissors" /></span>
              <h3>MVP scope limiter</h3>
              <p>Cuts nice-to-haves into a “later” list so you can launch a testable build in weeks, not quarters.</p>
              <div className="mini-viz">
                <div className="scope" id="scope">
                  <span className="keep">Database connector <em>Must-have</em></span>
                  <span className="cut">Dark mode <em>Later</em></span>
                  <span className="keep">Field mapping UI <em>Must-have</em></span>
                  <span className="cut">Slack bot <em>Later</em></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= TRUST RULES (instead of testimonials) ================= */}
        <section className="pad">
          <div className="head rv">
            <span className="eyebrow"><i />Trust rules</span>
            <h2 className="h2">Built to tell you the truth,<br /><span className="soft">not what you want to hear</span></h2>
            <p className="lead">Most AI tools sound confident. We&apos;d rather show you exactly what is known, what is guessed, and what still needs testing.</p>
          </div>
          <div className="principles">
            {PRINCIPLES.map((p, i) => (
              <div key={p.kind} className="card principle rv" style={v({ "--d": `${(i % 3) * 0.12}s` })}>
                <span className="kind" style={{ color: p.color, background: p.bg }}>{p.kind}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= CAPABILITIES ================= */}
        <section id="capabilities" className="pad" style={{ background: "var(--bg-soft)" }}>
          <div className="head rv">
            <span className="eyebrow"><i />Capabilities</span>
            <h2 className="h2">Advanced capabilities.<br /><span className="soft">Effortless experience.</span></h2>
            <p className="lead">Built to cut noise, stop over-engineering and keep your feedback loops short.</p>
          </div>
          <div className="bento">
            <div className="card feat span2 rv">
              <span className="ico"><Ic id="search" /></span>
              <h3>Search your whole workspace</h3>
              <p>Find any source, competitor, interview note or decision across your projects in seconds.</p>
              <div className="cmdk">
                <div className="cmdk-in">
                  <Ic id="search" />
                  <span><span id="typed" /><span className="caret" /></span>
                  <span className="kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
                </div>
                <div className="cmdk-res" id="cmdRes">
                  <div className="hl"><Ic id="bulb" />Ideas matching “RevOps”<small>Ideas</small></div>
                  <div><Ic id="link" />Sources mentioning “pricing”<small>Sources</small></div>
                  <div><Ic id="chart" />Competitors in this project<small>Competitors</small></div>
                </div>
              </div>
            </div>
            <div className="card feat rv" style={v({ "--d": ".12s" })}>
              <span className="ico"><Ic id="flask" /></span>
              <h3>Experiment tracker</h3>
              <p>Hypothesis, audience, success criteria, dates, results and learnings for every test.</p>
              <div className="lab">
                <div className="row">Customer interviews<b>Running</b></div>
                <div className="row">Waitlist page<b>Planned</b></div>
                <div className="row">Pre-sale<b>Planned</b></div>
              </div>
            </div>
            <div className="card feat rv">
              <span className="ico"><Ic id="term" /></span>
              <h3>Build kit for coding agents</h3>
              <p>Export your MVP plan as a markdown spec and prompt that coding agents can follow.</p>
              <div className="docs">
                <div className="doc"><Ic id="file" />spec.md<small>MVP scope</small></div>
                <div className="doc"><Ic id="file" />journeys.md<small>User journeys</small></div>
                <div className="doc"><Ic id="file" />checklist.md<small>Launch</small></div>
              </div>
            </div>
            <div className="card feat rv" style={v({ "--d": ".12s" })}>
              <span className="ico"><Ic id="folder" /></span>
              <h3>One project memory</h3>
              <p>Research, competitors, personas and experiments are shared by every module — nothing gets re-invented.</p>
              <div className="meter">
                <div className="m"><div><span>Research</span><b>Shared</b></div><div className="hbar"><i style={v({ "--w": "100%" })} /></div></div>
                <div className="m"><div><span>Competitors</span><b>Shared</b></div><div className="hbar"><i style={v({ "--w": "100%" })} /></div></div>
                <div className="m"><div><span>Experiments</span><b>Shared</b></div><div className="hbar"><i style={v({ "--w": "100%" })} /></div></div>
              </div>
            </div>
            <div className="card feat rv" style={v({ "--d": ".24s" })}>
              <span className="ico"><Ic id="eye" /></span>
              <h3>Transparent credits</h3>
              <p>See exactly what each AI action costs. Credits are reserved before a job and refunded if it fails.</p>
              <div className="lab">
                <div className="row">1 · Reserved before the job<b>−5</b></div>
                <div className="row">2 · Charged only for what ran<b>−3</b></div>
                <div className="row">3 · Refunded if it fails<b>+2</b></div>
              </div>
            </div>
            <div className="card feat span3 rv">
              <div className="private">
                <div>
                  <span className="ico"><Ic id="shield" /></span>
                  <h3>Private by default</h3>
                  <p>Your ideas, notes and research are isolated to your account. Sessions use secure httpOnly cookies, and your workspace is never used to train shared models.</p>
                </div>
                <div className="cipher" id="cipher">
                  <span className="lk"><Ic id="lock" /></span>
                  <div><span className="k">workspace</span>: <span className="s">&quot;yours-only&quot;</span></div>
                  <div><span className="k">idea</span>: <span className="scr" data-scramble="CRM ⇄ Postgres sync">CRM ⇄ Postgres sync</span></div>
                  <div><span className="k">notes</span>: <span className="scr" data-scramble="interview transcripts">interview transcripts</span></div>
                  <div><span className="k">used_for_training</span>: <span className="s">false</span></div>
                  <div><span className="k">access</span>: <span className="s">&quot;owner only&quot;</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PricingSection />

        {/* ================= FAQ ================= */}
        <section id="faq" className="pad" style={{ background: "var(--bg-soft)" }}>
          <div className="faq-grid">
            <div className="head left rv" style={{ margin: 0 }}>
              <span className="eyebrow"><i />FAQ</span>
              <h2 className="h2">Clear answers<br /><span className="soft">before you start</span></h2>
              <p className="lead">Questions about sources, accuracy or privacy? Here&apos;s exactly how it works.</p>
            </div>
            <div className="faq rv" style={v({ "--d": ".1s" })} id="faqList">
              {FAQ.map((f, i) => (
                <div key={f.q} className={`q${i === 0 ? " open" : ""}`}>
                  <button type="button" aria-expanded={i === 0}>
                    {f.q}
                    <span className="pm"><Ic id="plus" style={{ width: 14 }} /></span>
                  </button>
                  <div className="a"><div><p>{f.a}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="cta-wrap">
          <div className="cta rv-scale">
            <div className="bloom" />
            <div className="gridbg" />
            <span className="floaty" style={{ left: "6%", top: "18%" }}><Ic id="link" />FACT · sourced</span>
            <span className="floaty" style={{ right: "7%", top: "26%", animationDelay: "-2s" }}><Ic id="spark" />ANALYSIS · labelled</span>
            <span className="floaty" style={{ left: "10%", bottom: "16%", animationDelay: "-4s" }}><Ic id="flask" />ASSUMPTION · tested</span>
            <span className="eyebrow"><i />Free during early access</span>
            <h2>Stop guessing.<br /><span>Start validating with real evidence.</span></h2>
            <p>Create your workspace in a minute and turn your idea into hypotheses you can actually test.</p>
            <div className="actions">
              <Link href="/signup" className="btn btn-light">Start validating free<ArrowChip /></Link>
              <a href="#features" className="btn btn-ghost">Explore features</a>
            </div>
            <div className="fine">No credit card required · Your ideas stay private</div>
          </div>
        </section>

        <MarketingFooter />
      </main>

      <LandingEffects />
    </div>
  );
}
