import { z } from "zod";

/*
 * Traditional → Innovative: the client shows how something is done today (a video of the manual work,
 * photos, screenshots, PDFs or a written description) and Muse Spark proposes software that replaces it.
 * Two modes: "process" (a small business or a team doing work by hand) and "enterprise" (hard, complex
 * problems in big companies and regulated industries).
 */

export const INNOVATION_MODES = ["process", "enterprise"] as const;
export type InnovationMode = (typeof INNOVATION_MODES)[number];

export const INDUSTRIES = [
  "Oil & gas",
  "Energy & utilities",
  "Banking",
  "Insurance",
  "Healthcare & hospitals",
  "Pharma & life sciences",
  "Manufacturing",
  "Logistics & shipping",
  "Aviation & airports",
  "Construction & real estate",
  "Mining & metals",
  "Telecom",
  "Retail & e-commerce",
  "Agriculture & food",
  "Government & public sector",
  "Education",
  "Hospitality & travel",
  "Automotive",
  "Legal & compliance",
  "Other",
] as const;

export const COMPANY_SIZES = ["Small business (under 50 people)", "Mid-size (50–1,000)", "Large (1,000–10,000)", "Enterprise (10,000+)"] as const;

/** Upload limits. Video is sampled into frames and its soundtrack transcribed; PDFs are read as text. */
export const INNOVATION_LIMITS = {
  files: 8,
  videoMb: 100,
  imageMb: 10,
  pdfMb: 20,
  videoSeconds: 10 * 60,
  /** Frames sampled from each video and sent to Muse Spark. */
  framesPerVideo: 10,
  /** Images Muse Spark sees in one request (frames + photos). */
  maxImages: 14,
  pdfChars: 24_000,
  notes: 4_000,
} as const;

export type MediaKind = "video" | "image" | "pdf";

export function mediaKindOf(name: string, type: string): MediaKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (type.startsWith("video/") || ["mp4", "mov", "webm", "m4v", "avi", "mkv"].includes(ext)) return "video";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  return null;
}

export const scanInputSchema = z
  .object({
    mode: z.enum(INNOVATION_MODES),
    title: z.string().trim().max(120).default(""),
    notes: z.string().trim().max(INNOVATION_LIMITS.notes).default(""),
    industry: z.enum(INDUSTRIES).nullable().default(null),
    companySize: z.enum(COMPANY_SIZES).nullable().default(null),
    region: z.string().trim().max(80).default(""),
  })
  .refine((v) => v.mode !== "enterprise" || v.industry, { message: "Pick an industry.", path: ["industry"] });
export type ScanInput = z.output<typeof scanInputSchema>;

/** One stored upload, plus what the worker made of it (sampled frames, transcript, PDF text length). */
export type ScanMedia = {
  key: string;
  kind: MediaKind;
  name: string;
  frames?: { key: string; atSec: number }[];
  durationSec?: number;
  transcript?: string;
  pdfChars?: number;
};

// --- What Muse Spark saw -------------------------------------------------------------------------------

export const observationSchema = z.object({
  summary: z.string().describe("Two or three sentences: what work is being done today and how."),
  setting: z.string().describe("Where this happens and for whom, e.g. 'a small car-repair garage' or 'a refinery maintenance team'."),
  people: z.array(z.string()).max(6).describe("Roles involved (e.g. 'front-desk clerk', 'field technician')."),
  steps: z
    .array(
      z.object({
        step: z.string().describe("Short name of the step."),
        howToday: z.string().describe("How it is done today, concretely (paper, phone calls, spreadsheets, walking over…)."),
        tools: z.array(z.string()).max(5).describe("Tools seen or mentioned (paper form, Excel, WhatsApp, radio…)."),
        pain: z.string().describe("What is slow, error-prone, risky or costly about it."),
        evidence: z.string().describe("Where this comes from: 'frame 3', 'photo 2', 'PDF p. 4', 'narration', or 'description'."),
      }),
    )
    .min(1)
    .max(10),
  dataHandled: z.array(z.string()).max(8).describe("Information that is written, copied, looked up or passed on."),
  bottlenecks: z.array(z.string()).max(5),
  risks: z.array(z.string()).max(5).describe("Safety, compliance, error or revenue risks visible in the current way of working."),
  confidence: z.enum(["high", "medium", "low"]).describe("How clearly the material shows the process."),
  gaps: z.array(z.string()).max(4).describe("What the material doesn't show and is worth asking about."),
});
export type Observation = z.output<typeof observationSchema>;

// --- Ideas ---------------------------------------------------------------------------------------------

export const IDEA_TYPES = ["saas", "automation", "internal_system", "ai_agent", "marketplace", "iot_hardware", "mobile_app", "data_platform"] as const;
export const IDEA_TYPE_LABEL: Record<(typeof IDEA_TYPES)[number], string> = {
  saas: "SaaS",
  automation: "Automation",
  internal_system: "Internal system",
  ai_agent: "AI agent",
  marketplace: "Marketplace",
  iot_hardware: "IoT + software",
  mobile_app: "Mobile app",
  data_platform: "Data platform",
};

const level = z.enum(["low", "medium", "high"]);

export const processIdeaSchema = z.object({
  title: z.string().describe("Product name or a short descriptive title."),
  oneLiner: z.string().describe("One sentence: what it does for whom."),
  type: z.enum(IDEA_TYPES),
  replacesSteps: z.array(z.number().int().min(1)).max(10).describe("Numbers (1-based) of the observed steps this replaces or automates."),
  howItWorks: z.string().describe("Two to four sentences on how the product works day to day."),
  automation: z.string().describe("What becomes automatic and what still needs a person."),
  whoPays: z.string().describe("The buyer and the user, if different."),
  pricing: z.string().describe("A plausible pricing model, labelled as an assumption."),
  mvp: z.array(z.string()).min(2).max(5).describe("The smallest first version: 2–5 features."),
  difficulty: level.describe("How hard it is to build."),
  timeToMvp: z.string().describe("Rough build time for a small team, e.g. '3–4 weeks'."),
  marketBreadth: z.string().describe("Who else has this same problem (other businesses, industries, regions)."),
  impact: z.string().describe("Expected gain (time, errors, money), clearly marked as an estimate or assumption."),
  risks: z.array(z.string()).min(1).max(3),
  firstTest: z.string().describe("The cheapest way to check that people want it, this week."),
});
export type ProcessIdea = z.output<typeof processIdeaSchema>;

export const enterpriseIdeaSchema = z.object({
  title: z.string(),
  oneLiner: z.string(),
  type: z.enum(IDEA_TYPES),
  problemArea: z.string().describe("The business problem and why it matters at this scale."),
  traditionalToday: z.string().describe("How large companies in this industry typically handle it today."),
  solution: z.string().describe("The proposed system: what it does, three to five sentences."),
  architecture: z.array(z.string()).min(3).max(7).describe("Main components (e.g. 'edge sensors', 'event pipeline', 'risk model', 'operator console')."),
  dataNeeded: z.array(z.string()).min(2).max(6),
  integrations: z.array(z.string()).max(6).describe("Systems it must connect to (e.g. SAP PM, SCADA/historian, core banking, EHR)."),
  aiRole: z.string().describe("What AI does here, and where a human stays in the loop."),
  buyer: z.string().describe("Who signs the contract (role) and who uses it."),
  valueHypothesis: z.string().describe("Where the value comes from (cost avoided, risk reduced, revenue), as a hypothesis to verify, never invented figures."),
  compliance: z.array(z.string()).max(4).describe("Regulations, standards or approvals to respect."),
  pilot: z.string().describe("A 60–90 day pilot: scope, site or team, and what success looks like."),
  salesCycle: z.string().describe("Typical sales cycle and procurement path."),
  difficulty: level,
  risks: z.array(z.string()).min(1).max(4),
  startupAngle: z.string().describe("How a small startup could enter: the wedge product to sell first."),
});
export type EnterpriseIdea = z.output<typeof enterpriseIdeaSchema>;

export const processIdeasSchema = z.object({ ideas: z.array(processIdeaSchema).min(3).max(8) });
export const enterpriseIdeasSchema = z.object({ ideas: z.array(enterpriseIdeaSchema).min(3).max(6) });

export type InnovationIdea = ProcessIdea | EnterpriseIdea;
export const isEnterpriseIdea = (i: InnovationIdea): i is EnterpriseIdea => "architecture" in i;
