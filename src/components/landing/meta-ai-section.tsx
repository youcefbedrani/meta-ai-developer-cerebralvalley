import { EventMark, HACKATHON, MetaMark } from "@/components/brand/hackathon-lockup";
import { Wordmark } from "@/components/brand/logo";
import { Ic } from "./icons";

/*
 * "Built with Meta AI": what Startum does with Meta's models, how a run works step by step, and a replay of a
 * real measured Autopilot run. Numbers come from HACKATHON.md (measured runs), never invented.
 * Animations start when the section scrolls in (.rv → .in, see landing-effects) and are off under reduced motion.
 */

const v = (o: Record<string, string>) => o as React.CSSProperties;

const MODELS = [
  { name: "Muse Spark", role: "The brain: plans, calls tools, reads screenshots, writes every plan with native JSON Schema output." },
  { name: "Muse Spark Open", role: "Meta's open-weights model on Baseten: reads sources, competitors and forum threads 3–6× faster." },
  { name: "Muse Image", role: "Renders the logo mark, the landing hero and one ad per channel from an art-director brief." },
  { name: "SAM 3.1", role: "Segments the logo and cuts it out onto a transparent background." },
  { name: "Muse Voice", role: "Transcribes spoken pitches and customer interviews, with who said what and timestamps." },
];

const STEPS = [
  { icon: "play", model: "Muse Voice + Muse Spark", title: "Say your idea out loud", text: "Record a pitch in the browser. Muse Voice writes it down, Muse Spark turns it into a project and keeps your own doubt (“would they pay?”) as the question to answer.", stat: "53 s pitch → project in 16 s" },
  { icon: "spark", model: "Muse Spark · tool calling", title: "The Autopilot plans its research", text: "An agent with ten tools decides what to do next and narrates each step on a live timeline: research, evidence, web search, plans, brand, landing page, playbook, verdict.", stat: "10 tools · live trace" },
  { icon: "search", model: "Muse Spark Open on Baseten", title: "It reads the market", text: "Research sources, competitor pricing pages and Reddit / Hacker News threads are read in parallel. A customer quote is kept only if it appears word for word in the source.", stat: "Extraction 3–6× faster on open weights" },
  { icon: "link", model: "Muse Spark + web search", title: "It checks the open questions", text: "For the one to three questions that decide the idea (real prices, existing tools, regulations), it searches the web and reads the results.", stat: "Up to 4 searches, repeats cached" },
  { icon: "shield", model: "Muse Spark · verified", title: "It decides: Build, Pivot or Drop", text: "Every reason must cite a URL the run actually read. Reasons with unseen URLs are thrown out, and a verdict with fewer than two verified reasons is sent back.", stat: "0 invented sources" },
  { icon: "bulb", model: "Muse Spark + Muse Image + SAM 3.1", title: "It designs the brand", text: "Muse Spark writes the art direction from real customer quotes, Muse Image renders logo, hero and ads, SAM 3.1 cuts the logo out. Headlines use the customers' own words.", stat: "5 visuals in ~30 s for $0.06" },
  { icon: "trend", model: "Muse Spark · structured output", title: "It sets up the launch", text: "A branded landing page with a waitlist to test demand, and a launch playbook: six stages with gates, a founder-led sales plan, SaaS metrics and week-by-week build prompts.", stat: "Revenue maths computed by code" },
];

const TRACE = [
  { k: "tool", t: "read_project", d: "Daycare compliance deadline tracker · no research yet" },
  { k: "tool", t: "run_market_validation", d: "3 of 3 research steps finished" },
  { k: "tool", t: "read_evidence", d: "Sources, competitors and customer quotes" },
  { k: "tool", t: "web_search ×2", d: "The open questions that decide the idea" },
  { k: "tool", t: "generate_business_model", d: "Tiers anchored on verified competitor prices" },
  { k: "tool", t: "generate_mvp_plan", d: "Must-haves, journeys, data model, milestones" },
  { k: "tool", t: "design_brand", d: "Brand “Bindly” with 5 visuals (logo, hero, ads)" },
  { k: "tool", t: "create_landing_page", d: "Branded waitlist page with the Muse Image hero" },
  { k: "verdict", t: "submit_verdict", d: "BUILD · 67% · 8 cited reasons · 0 dropped" },
];

const FEATURES = [
  { icon: "spark", title: "Validation Autopilot", models: ["Muse Spark"], text: "From a bare idea to a cited Build / Pivot / Drop verdict, with plans, brand and a landing page for ideas worth building.", stat: "4 min 55 s · $0.47" },
  { icon: "play", title: "Pitch it out loud", models: ["Muse Voice", "Muse Spark"], text: "Speak for a minute; get a structured project and an Autopilot focused on your own question.", stat: "Project in ~15 s" },
  { icon: "user", title: "Voice interviews", models: ["Muse Voice", "Muse Spark"], text: "Upload a customer call: speakers separated, verified pain and willingness-to-pay quotes that play back from the moment they were said.", stat: "3 min call → 8 turns in 35 s" },
  { icon: "bulb", title: "Brand visuals", models: ["Muse Image", "SAM 3.1", "Muse Spark"], text: "Logo cut out on transparency, a full-bleed landing hero and channel ads, all from the research.", stat: "5 visuals · $0.06" },
  { icon: "eye", title: "Page review", models: ["Muse Spark vision"], text: "Drop a screenshot of your page or a competitor's: issues pinned on the image, prices read off the page, where you can win.", stat: "Pins on the exact element" },
  { icon: "trend", title: "Launch playbook", models: ["Muse Spark"], text: "Idea to market in one plan: stage gates, ICP, outreach, discovery, demo, objections, funnel, LTV and AI-coding prompts.", stat: "~60 s · $0.06" },
  { icon: "list", title: "Copilot ideas → projects", models: ["Muse Spark"], text: "Ask the Copilot for ideas; every idea gets Create project and Validate with Autopilot buttons.", stat: "Two clicks to a verdict" },
  { icon: "scissors", title: "Gold Mine pain mining", models: ["Muse Spark Open"], text: "Finds what customers already complain about on Reddit, Hacker News and forums, quotes checked word for word.", stat: "11 verified quotes · 4 clusters" },
  { icon: "chart", title: "Everything else, on Muse Spark", models: ["Muse Spark"], text: "Research reports, competitors, business model, MVP plan, marketing plans and assets, interview scripts, Copilot.", stat: "36 / 37 end-to-end steps pass" },
];

const RULES = [
  "Every verdict reason cites a URL the agent read during the run",
  "Customer quotes are kept only if they appear word for word",
  "Prices only from verified competitor pages, never guessed",
  "Revenue maths computed by code from your pricing",
  "Targets and benchmarks are labelled as assumptions",
  "Credits are refunded automatically when a job fails",
];

export function MetaAiSection() {
  return (
    <section id="meta-ai" className="pad meta-ai">
      <div className="head rv">
        <span className="eyebrow"><i />Built with Meta AI</span>
        <div className="meta-lockup" aria-label={`Startum × Meta × ${HACKATHON.name}`}>
          <Wordmark className="text-[40px] text-[var(--plum)]" />
          <span className="x" aria-hidden="true">×</span>
          <MetaMark />
          <span className="x" aria-hidden="true">×</span>
          <EventMark className="text-[var(--plum)]" />
        </div>
        <h2 className="h2">One idea in.<br /><span className="grad-text">A validated startup out.</span></h2>
        <p className="lead">Built for the {HACKATHON.name}. Five Meta models work together so a founder can go from a spoken idea to evidence, a verdict, a brand and a launch plan in minutes.</p>
      </div>

      {/* The models */}
      <div className="meta-models">
        {MODELS.map((m, i) => (
          <div key={m.name} className="card meta-model rv" style={v({ "--d": `${i * 0.07}s` })}>
            <span className="meta-model-name"><MetaMark /> {m.name}</span>
            <p>{m.role}</p>
          </div>
        ))}
      </div>

      {/* How it works + live run */}
      <div className="meta-how">
        <div className="meta-steps rv">
          <h3 className="meta-sub">How it works, step by step</h3>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title} style={v({ "--i": String(i) })}>
                <span className="meta-step-dot"><Ic id={s.icon} /></span>
                <div>
                  <span className="meta-chip">{s.model}</span>
                  <h4>{i + 1}. {s.title}</h4>
                  <p>{s.text}</p>
                  <span className="meta-stat"><Ic id="check" /> {s.stat}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="meta-run-wrap">
          <div className="card meta-run rv">
            <div className="meta-run-head">
              <span className="dots"><i /><i /><i /></span>
              <span>Validation Autopilot · live trace</span>
              <span className="example">Real measured run</span>
            </div>
            <ul>
              {TRACE.map((l, i) => (
                <li key={l.t} className={`mt-line ${l.k}`} style={v({ "--d": `${0.35 + i * 0.55}s` })}>
                  <span className="tl-tool">{l.t}</span>
                  <span className="tl-d">{l.d}</span>
                </li>
              ))}
            </ul>
            <div className="meta-run-foot mt-line" style={v({ "--d": `${0.35 + TRACE.length * 0.55}s` })}>
              <div><b>4 min 55 s</b><small>idea to verdict</small></div>
              <div><b>$0.47</b><small>total AI cost</small></div>
              <div><b>8 / 8</b><small>reasons verified</small></div>
            </div>
          </div>
          <div className="card meta-rules rv" style={v({ "--d": ".15s" })}>
            <h3 className="meta-sub"><Ic id="shield" /> Verifiable by construction</h3>
            <ul>{RULES.map((r) => <li key={r}><Ic id="check" /> {r}</li>)}</ul>
          </div>
        </div>
      </div>

      {/* Everything Startum does */}
      <h3 className="meta-sub meta-center rv">Everything Startum does with Meta AI</h3>
      <div className="meta-features">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="card feat meta-feature rv" style={v({ "--d": `${(i % 3) * 0.1}s` })}>
            <span className="ico"><Ic id={f.icon} /></span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            <div className="meta-feature-foot">
              <span className="meta-chips">{f.models.map((m) => <span key={m} className="meta-chip">{m}</span>)}</span>
              <span className="meta-stat"><Ic id="check" /> {f.stat}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="meta-note rv">
        Measured on the live product during the hackathon.{" "}
        <a href={HACKATHON.writeUp} target="_blank" rel="noopener noreferrer">Read exactly what we built and how →</a>
      </p>
    </section>
  );
}
