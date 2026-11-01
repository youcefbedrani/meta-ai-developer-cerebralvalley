import type { EnterpriseIdea, Observation, ProcessIdea, ScanInput } from "@/lib/validation/innovation";
import { asData, UNTRUSTED_DATA_RULE } from "../run";

export const INNOVATION_PROMPT_VERSION = "innovation.v1";

const HONESTY = `Honesty rules:
- Describe only what the material shows or says. When you infer something, say "probably" or put it in "gaps". Never invent people, numbers, companies, quotes or results.
- Every figure about savings, market size or revenue is an estimate: write it as "estimate:" or "assumption:", and prefer ranges and reasoning over precise numbers.
- ${UNTRUSTED_DATA_RULE}`;

export const OBSERVE_SYSTEM = `You are an operations analyst who studies how work is done today, by hand or with old tools, so it can be replaced by software. You receive what the client uploaded: frames sampled from a video (numbered, with their time in seconds), photos or screenshots (numbered), text from PDFs (with page numbers), a transcript of what was said in the video, and the client's own description.

Map the current way of working:
- The steps in order, each with how it is done today (concretely: paper forms, phone calls, spreadsheets, walking to another desk, re-typing, waiting), the tools you see, the pain (slow, error-prone, costly, risky, unpleasant) and the evidence ("frame 4", "photo 2", "PDF p. 3", "narration", "description").
- The information being written, copied, looked up or passed between people.
- Bottlenecks, risks (safety, compliance, errors, lost revenue) and what the material doesn't show.
Be concrete and specific to what you see; no generic consulting language.

${HONESTY}`;

export const PROCESS_IDEAS_SYSTEM = `You are a founder-minded product strategist. From a map of how work is done today, propose software that turns this traditional way of working into an innovative one: SaaS products, automations, internal systems, AI agents, mobile apps or marketplaces.

Rules for the ideas:
- 5–8 ideas, from the quick win (a small automation a solo founder can ship in weeks) to the bold one (a platform that changes how the whole trade works).
- Each idea must replace or automate specific observed steps: list them in "replacesSteps" (1-based). Ideas not grounded in the observed process are not allowed.
- Think about who else has this exact problem (other businesses in the trade, other industries, other countries): a good SaaS idea sells to many, not just this one client.
- Be specific: name the moment in the day the product is used, the data it captures, what becomes automatic.
- Prefer ideas a small team can build and sell; say plainly when something needs hardware, regulation or big integrations.
- "firstTest" must be doable this week with almost no money.

${HONESTY}`;

export const ENTERPRISE_IDEAS_SYSTEM = `You are a senior innovation strategist for large companies and regulated industries (oil and gas, energy, banking, insurance, healthcare, manufacturing, logistics, telecom, public sector and others). You think like a CTO and a venture builder at the same time: deep knowledge of how these industries really operate, their legacy systems, safety and compliance constraints, and how they buy technology.

Propose 4–6 complex, high-value system ideas that move a traditional practice to an innovative one:
- Ground each idea in a real, recognisable problem of this industry (and in the client's description and uploads when given). Explain how it is typically handled today.
- Design the solution as a system: components, data it needs, the systems it must integrate with (e.g. SAP, SCADA/historians, core banking, EHR, GIS), where AI helps and where a human stays in control.
- Respect reality: safety cases, regulation (e.g. API/ISO standards, Basel, PCI DSS, HIPAA, GDPR, SOX), procurement and long sales cycles. Name them.
- The value must be a hypothesis to verify with the buyer (cost avoided, downtime reduced, risk lowered, revenue): explain the mechanism, never invent specific figures or case studies.
- Include a realistic 60–90 day pilot and the "startupAngle": the narrow wedge product a small startup could sell first to get in.
- Mix horizons: at least one idea that can be piloted within a quarter, and at least one ambitious, transformational one.

${HONESTY}`;

export type ScanMaterial = {
  images: { label: string }[];
  pdfs: { name: string; text: string }[];
  transcripts: { name: string; text: string }[];
};

function material(m: ScanMaterial): string {
  const parts: string[] = [];
  if (m.images.length) parts.push(`Images attached, in order: ${m.images.map((i, n) => `#${n + 1} = ${i.label}`).join("; ")}.`);
  for (const t of m.transcripts) parts.push(asData("video_transcript", `${t.name}\n${t.text}`));
  for (const p of m.pdfs) parts.push(asData("pdf_text", `${p.name}\n${p.text}`));
  return parts.join("\n\n");
}

function context(input: ScanInput): string {
  const lines = [
    input.title ? `Title: ${input.title}` : null,
    input.industry ? `Industry: ${input.industry}` : null,
    input.companySize ? `Company size: ${input.companySize}` : null,
    input.region ? `Region: ${input.region}` : null,
  ].filter(Boolean);
  return `${lines.join("\n")}\n\n${asData("client_description", input.notes || "No written description: rely on the uploads.")}`;
}

export function buildObservePrompt(input: ScanInput, m: ScanMaterial): string {
  return `Map how this work is done today.\n\n${context(input)}\n\n${material(m)}`;
}

export function buildProcessIdeasPrompt(input: ScanInput, observation: Observation): string {
  return `Propose software ideas that replace this traditional way of working.\n\n${context(input)}\n\n${asData("observed_process", observation)}`;
}

export function buildEnterpriseIdeasPrompt(input: ScanInput, m: ScanMaterial, observation: Observation | null): string {
  return `Propose complex, high-value system ideas for ${input.industry ?? "this industry"}${input.companySize ? ` (${input.companySize})` : ""}${input.region ? ` in ${input.region}` : ""}.

${context(input)}
${observation ? `\n${asData("observed_process", observation)}\n` : ""}
${material(m)}`;
}

// --- Mocks (AI_PROVIDER=mock, development only) ---------------------------------------------------------

export function mockObservation(): Observation {
  return {
    summary: "[Mock] A front-desk clerk writes job cards by hand and phones customers when their car is ready.",
    setting: "[Mock] A small car-repair garage",
    people: ["Front-desk clerk", "Mechanic"],
    steps: [
      { step: "Take the job", howToday: "Paper job card filled at the counter", tools: ["Paper form"], pain: "Handwriting is hard to read; cards get lost", evidence: "description" },
      { step: "Tell the customer", howToday: "Clerk phones each customer", tools: ["Phone"], pain: "Calls go unanswered; time wasted", evidence: "description" },
    ],
    dataHandled: ["Customer name and phone", "Car plate", "Work to do"],
    bottlenecks: ["Phone calls at closing time"],
    risks: ["Lost job cards mean unbilled work"],
    confidence: "low",
    gaps: ["[Mock] No real analysis: AI_PROVIDER=mock"],
  };
}

export function mockProcessIdeas(): { ideas: ProcessIdea[] } {
  const base: ProcessIdea = {
    title: "[Mock] Digital job cards",
    oneLiner: "Job cards on a tablet with automatic 'car ready' texts.",
    type: "saas",
    replacesSteps: [1, 2],
    howItWorks: "The clerk fills a short form on a tablet; when the mechanic marks the job done, the customer gets a text.",
    automation: "Texts are automatic; the clerk still checks the car in.",
    whoPays: "Garage owner",
    pricing: "assumption: a monthly subscription per garage",
    mvp: ["Job form", "Status board", "Automatic SMS"],
    difficulty: "low",
    timeToMvp: "3–4 weeks",
    marketBreadth: "Independent garages, bike shops, appliance repair",
    impact: "estimate: fewer phone calls and no lost cards",
    risks: ["Owners used to paper"],
    firstTest: "Show a clickable mock-up to five garages this week",
  };
  return { ideas: [base, { ...base, title: "[Mock] Repair status page", type: "automation" }, { ...base, title: "[Mock] Parts reorder agent", type: "ai_agent" }] };
}

export function mockEnterpriseIdeas(): { ideas: EnterpriseIdea[] } {
  const base: EnterpriseIdea = {
    title: "[Mock] Predictive maintenance copilot",
    oneLiner: "Flags equipment likely to fail and drafts the work order.",
    type: "ai_agent",
    problemArea: "Unplanned downtime of rotating equipment",
    traditionalToday: "Fixed-interval inspections and paper checklists",
    solution: "Sensor data and maintenance history feed a risk model; planners approve suggested work orders.",
    architecture: ["Sensor gateway", "Event pipeline", "Risk model", "Planner console"],
    dataNeeded: ["Vibration and temperature readings", "Maintenance history"],
    integrations: ["SAP PM", "Plant historian"],
    aiRole: "Ranks risk and drafts orders; a planner approves every order.",
    buyer: "VP Operations; used by maintenance planners",
    valueHypothesis: "assumption: less unplanned downtime, to verify in a pilot",
    compliance: ["Site safety management rules"],
    pilot: "90 days on one unit's pumps; success = earlier warnings than the current inspections",
    salesCycle: "6–18 months through procurement",
    difficulty: "high",
    risks: ["Data access on site"],
    startupAngle: "Sell a read-only risk dashboard on historian data first",
  };
  return { ideas: [base, { ...base, title: "[Mock] Permit-to-work digitisation" }, { ...base, title: "[Mock] Inspection photo triage" }] };
}
