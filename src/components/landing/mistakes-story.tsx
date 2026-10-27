"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ArrowChip, Ic } from "./icons";

/*
 * "The mistakes that sink most first SaaS products": a scroll story. On desktop the steps scroll on the left
 * while a sticky stage on the right shows an animated illustration of the active mistake, which then turns
 * into how Startum fixes it. On small screens every step shows its own illustration inline.
 * Illustrations are CSS and markup only (no images), labelled as examples, with no invented statistics.
 */

type Mistake = { title: string; pain: string; fix: string; tool: string };

const MISTAKES: Mistake[] = [
  { title: "Building for months before anyone asks for it", pain: "You write code for months, launch, and hear nothing. The idea was never tested.", fix: "Validate my idea runs market research, a competitor scan and real customer voices in one click, and ends with a Go, Pivot or Drop verdict before you write any code.", tool: "Validate my idea" },
  { title: "Solving a problem only you have", pain: "The pain feels huge to you, but customers don't feel it or won't pay to fix it.", fix: "Market voices and Gold Mine collect what real people say on Reddit, YouTube, reviews and forums, with links, so you build on pains customers already complain about.", tool: "Market voices · Gold Mine" },
  { title: "“There are no competitors”", pain: "No competitors usually means no market, or that you haven't looked yet.", fix: "The competitor scan maps direct, indirect and DIY alternatives, with prices only when a source shows them, and shows the gap you can own.", tool: "Competitors" },
  { title: "Targeting everyone", pain: "A product for “small businesses” speaks to nobody, and your marketing never lands.", fix: "You get one sharp target customer, a micro-SaaS fit check, and how many customers you need to reach $1k, $5k and $10k a month.", tool: "Verdict · Micro-SaaS fit" },
  { title: "Too many features in version one", pain: "The MVP grows for months and never ships, or ships confusing.", fix: "The MVP plan splits must-haves from later, writes user journeys and acceptance criteria, and exports a kit for Claude Code, Cursor or any AI coding tool.", tool: "MVP plan · Design" },
  { title: "Guessing the price", pain: "Too cheap and you can't grow; too expensive and nobody tries it.", fix: "A suggested price from the competitor prices we actually found, with the reasoning shown, so you start from evidence instead of a guess.", tool: "Pricing evidence" },
  { title: "Launching to silence", pain: "Marketing starts after the build, so day one has no audience.", fix: "A themed waitlist landing page, tracked visits and signups, and a Marketing Studio plan with ready-to-post assets, so you have an audience before launch.", tool: "Landing pages · Marketing Studio" },
  { title: "Drowning in courses and conflicting advice", pain: "Hundreds of hours of videos and expensive mentors, and still no clear next step.", fix: "One step-by-step path from idea to launch, with AI help at every step and your next move always shown.", tool: "Start here guide" },
];

type Phase = "mistake" | "fix";

export function MistakesStory() {
  const [active, setActive] = useState(0);
  // The view belongs to one step: moving to another step starts again from "the mistake".
  const [view, setView] = useState<{ i: number; phase: Phase; pinned: boolean }>({ i: 0, phase: "mistake", pinned: false });
  const phase: Phase = view.i === active ? view.phase : "mistake";
  const pinned = view.i === active && view.pinned;
  const steps = useRef<(HTMLElement | null)[]>([]);

  // The step crossing the middle of the screen is the active one.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(Number((hit.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01, 0.5, 1] },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Each mistake shows for a moment, then turns into the fix (unless the visitor picked a view).
  useEffect(() => {
    const id = window.setTimeout(() => setView((v) => (v.i === active && v.pinned ? v : { i: active, phase: "fix", pinned: false })), 1700);
    return () => window.clearTimeout(id);
  }, [active]);

  const pick = (p: Phase) => setView({ i: active, phase: p, pinned: true });

  return (
    <section id="mistakes" className="pad ms-section">
      <div className="head rv">
        <span className="eyebrow"><i />Why {BRAND.name}</span>
        <h2 className="h2">The mistakes that sink most first SaaS products.<br /><span className="grad-text">And how we help you avoid them.</span></h2>
        <p className="lead">Most first products don&apos;t fail because of bad code. They fail because of what happened before the code. {BRAND.name} turns each of these traps into a clear step.</p>
      </div>

      <div className="ms-wrap">
        <ol className="ms-steps" style={{ "--progress": `${((active + 1) / MISTAKES.length) * 100}%` } as React.CSSProperties}>
          {MISTAKES.map((m, i) => (
            <li key={m.title} ref={(el) => { steps.current[i] = el; }} data-i={i} className={`ms-step${i === active ? " on" : ""}${i < active ? " done" : ""}`}>
              <span className="ms-no">{String(i + 1).padStart(2, "0")}</span>
              <div className="ms-body">
                <span className="ms-label bad">The mistake</span>
                <h3>{m.title}</h3>
                <p className="ms-pain">{m.pain}</p>
                <div className="ms-fix">
                  <span className="ms-label good"><Ic id="check" style={{ width: 12, height: 12 }} />How {BRAND.name} helps</span>
                  <p>{m.fix}</p>
                  <span className="ms-tool">{m.tool}</span>
                </div>
                {/* Small screens: the illustration sits under its own step. */}
                <div className="ms-inline" aria-hidden="true">
                  <Stage index={i} phase={i === active ? phase : "fix"} />
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="ms-sticky" aria-hidden="true">
          <div className="ms-stage-card">
            <div className="ms-stage-top">
              <span className="ms-count"><b>{String(active + 1).padStart(2, "0")}</b> / {String(MISTAKES.length).padStart(2, "0")}</span>
              <div className="ms-toggle">
                <button type="button" tabIndex={-1} className={phase === "mistake" ? "sel bad" : ""} onClick={() => pick("mistake")}>The mistake</button>
                <button type="button" tabIndex={-1} className={phase === "fix" ? "sel good" : ""} onClick={() => pick("fix")}>With {BRAND.name}</button>
              </div>
            </div>
            <Stage key={active} index={active} phase={phase} />
            <p className="ms-caption">
              <span className={`dot ${phase}`} />
              {phase === "mistake" ? MISTAKES[active].pain : MISTAKES[active].tool}
              {pinned ? null : <span className="ms-auto" />}
            </p>
            <span className="ms-example">Illustration</span>
          </div>
        </div>
      </div>

      <div className="ms-cta rv">
        <Link href="/signup" className="btn btn-dark">Start free, avoid all eight <ArrowChip /></Link>
        <span>No credit card. Your ideas stay private.</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ stages */

function Stage({ index, phase }: { index: number; phase: Phase }) {
  const Scene = SCENES[index];
  return (
    <div className={`ms-stage s${index + 1} ${phase === "fix" ? "is-fix" : "is-mistake"}`}>
      <Scene />
    </div>
  );
}

/** 1. Months of building → one-click validation with a verdict. */
function SceneBuild() {
  return (
    <>
      <div className="mk">
        <div className="tl">
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((mo, i) => (
            <div key={mo} className="tl-col" style={{ "--i": i } as React.CSSProperties}>
              <span className="tl-bar" />
              <small>{mo}</small>
            </div>
          ))}
        </div>
        <div className="tl-launch">
          <span className="rocket">🚀</span>
          <div><b>Launch day</b><small>0 sign-ups · 0 replies</small></div>
        </div>
      </div>
      <div className="fx">
        <div className="vd">
          <div className="vd-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" className="trk" /><circle cx="60" cy="60" r="50" className="arc" /></svg><b>72</b></div>
          <div className="vd-txt">
            <span className="go">GO</span>
            <b>Verdict before code</b>
            <ul>
              <li><i /> Market research <em>done</em></li>
              <li><i /> Competitors <em>done</em></li>
              <li><i /> Customer voices <em>done</em></li>
            </ul>
          </div>
        </div>
        <small className="fx-note">One click · about 3 minutes</small>
      </div>
    </>
  );
}

/** 2. A lonely idea → real quotes from where customers talk. */
function SceneProblem() {
  const quotes = [
    ["Reddit", "I spend every Friday chasing late invoices."],
    ["YouTube", "Asking clients for money again feels so awkward."],
    ["Reviews", "Every tool I tried is too expensive for a freelancer."],
  ];
  return (
    <>
      <div className="mk">
        <div className="lonely">
          <span className="bubble">“I need this!”</span>
          <span className="me">You</span>
          <div className="crowd">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}</div>
          <small>Customers: “…”</small>
        </div>
      </div>
      <div className="fx">
        {quotes.map(([src, q], i) => (
          <div key={src} className="qt" style={{ "--i": i } as React.CSSProperties}>
            <span className={`src ${src.toLowerCase()}`}>{src}</span>
            <p>“{q}”</p>
            <small><Ic id="link" style={{ width: 11, height: 11 }} /> source saved</small>
          </div>
        ))}
      </div>
    </>
  );
}

/** 3. An empty map → a competitor map with your gap. */
function SceneCompetitors() {
  const dots = [
    { x: 22, y: 26, n: "Big suite" },
    { x: 70, y: 22, n: "Enterprise tool" },
    { x: 30, y: 70, n: "Spreadsheet (DIY)" },
    { x: 78, y: 66, n: "Agency service" },
  ];
  return (
    <>
      <div className="mk">
        <div className="map empty">
          <span className="q">?</span>
          <small>“No competitors”</small>
        </div>
      </div>
      <div className="fx">
        <div className="map">
          <span className="ax x">Simple → Powerful</span>
          <span className="ax y">Cheap → Expensive</span>
          {dots.map((d, i) => (
            <span key={d.n} className="cdot" style={{ left: `${d.x}%`, top: `${d.y}%`, "--i": i } as React.CSSProperties}><i />{d.n}</span>
          ))}
          <span className="gap" style={{ left: "50%", top: "50%" }}>Your gap</span>
        </div>
      </div>
    </>
  );
}

/** 4. Everyone → one customer, and how many you need. */
function SceneTarget() {
  return (
    <>
      <div className="mk">
        <div className="everyone">
          {Array.from({ length: 40 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
          <small>“Small businesses”</small>
        </div>
      </div>
      <div className="fx">
        <div className="persona">
          <span className="av">FD</span>
          <div><b>Freelance designers</b><small>who invoice 5–20 clients a month</small></div>
        </div>
        <div className="ladder">
          {[["$1k/mo", 52, 35], ["$5k/mo", 260, 62], ["$10k/mo", 520, 100]].map(([g, n, w], i) => (
            <div key={g} className="rung" style={{ "--i": i, "--w": `${w}%` } as React.CSSProperties}>
              <span>{g}</span><i /><b>{n} customers</b>
            </div>
          ))}
          <small>at $19/month · example</small>
        </div>
      </div>
    </>
  );
}

/** 5. A never-ending feature list → must-haves and later. */
function SceneScope() {
  const all = ["Dashboard", "Reminders", "Team roles", "AI insights", "Mobile app", "Integrations", "Reports", "White label", "Chat", "Marketplace"];
  return (
    <>
      <div className="mk">
        <div className="pile">
          {all.map((f, i) => <span key={f} style={{ "--i": i } as React.CSSProperties}>{f}</span>)}
          <small>Ships in… ∞</small>
        </div>
      </div>
      <div className="fx">
        <div className="kanban">
          <div className="col must"><h6>Must-have</h6>{["Reminders", "Payment status", "Email templates"].map((f, i) => <span key={f} style={{ "--i": i } as React.CSSProperties}>{f}</span>)}</div>
          <div className="col later"><h6>Later</h6>{["Team roles", "Mobile app", "AI insights", "Integrations"].map((f, i) => <span key={f} style={{ "--i": i + 3 } as React.CSSProperties}>{f}</span>)}</div>
        </div>
        <small className="fx-note"><Ic id="file" style={{ width: 12, height: 12 }} /> Exported for Claude Code &amp; Cursor</small>
      </div>
    </>
  );
}

/** 6. A guessed price → a price from real competitor prices. */
function ScenePrice() {
  return (
    <>
      <div className="mk">
        <div className="guess">
          <span className="dice">$?</span>
          <div className="g-opts"><span>$5?</span><span>$49?</span><span>$199?</span></div>
        </div>
      </div>
      <div className="fx">
        <div className="scale">
          <div className="line" />
          {[["$12", 18], ["$19", 34], ["$29", 56], ["$49", 82]].map(([p, x], i) => (
            <span key={p} className="cp" style={{ left: `${x}%`, "--i": i } as React.CSSProperties}><i />{p}</span>
          ))}
          <span className="pin" style={{ left: "44%" }}><b>$24</b><small>suggested</small></span>
        </div>
        <small className="fx-note">From competitor prices found in sources · example</small>
      </div>
    </>
  );
}

/** 7. Launching to silence → an audience before launch. */
function SceneLaunch() {
  return (
    <>
      <div className="mk">
        <div className="silence">
          <span className="ear">🦗</span>
          <b>0</b>
          <small>people waiting on launch day</small>
        </div>
      </div>
      <div className="fx">
        <div className="wl">
          <div className="wl-top"><b className="wl-n">128</b><small>on the waitlist · example</small></div>
          <svg viewBox="0 0 220 70" className="wl-chart"><path d="M0 64 C30 62 40 55 60 50 S100 40 120 30 160 16 220 6" /></svg>
          <div className="wl-src">{["Reddit", "LinkedIn", "Newsletter"].map((s, i) => <span key={s} style={{ "--i": i } as React.CSSProperties}>{s}</span>)}</div>
        </div>
      </div>
    </>
  );
}

/** Scattered video cards: [left %, top %, rotation, minutes]. */
const TABS = [[2, 4, -8, 42], [46, 0, 6, 18], [20, 22, 3, 65], [58, 26, -5, 9], [4, 46, 7, 31], [40, 50, -3, 120], [64, 58, 9, 7], [14, 72, -6, 54], [48, 78, 4, 23]] as const;

/** 8. A pile of courses → one clear path. */
function ScenePath() {
  const path = ["Find an idea", "Validate it", "Design & build", "Launch & grow"];
  return (
    <>
      <div className="mk">
        <div className="tabs">
          {TABS.map(([x, y, r, min], i) => (
            <span key={i} style={{ "--i": i, left: `${x}%`, top: `${y}%`, rotate: `${r}deg` } as React.CSSProperties}><Ic id="play" style={{ width: 12, height: 12 }} /> Video {i + 1}<small>{min} min</small></span>
          ))}
        </div>
      </div>
      <div className="fx">
        <ol className="path">
          {path.map((p, i) => (
            <li key={p} style={{ "--i": i } as React.CSSProperties} className={i < 2 ? "ok" : i === 2 ? "now" : ""}>
              <i>{i < 2 ? <Ic id="check" style={{ width: 12, height: 12 }} /> : i + 1}</i>
              {p}
              {i === 2 ? <em>Next step</em> : null}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

const SCENES = [SceneBuild, SceneProblem, SceneCompetitors, SceneTarget, SceneScope, ScenePrice, SceneLaunch, ScenePath];
