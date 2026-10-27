import { CREDIT_COSTS } from "./plans";

/*
 * The founder journey shown in the "Start here" guide and on the dashboard:
 * from first idea to first customers. Content is static; progress comes from
 * the user's own data (see server/data/journey.ts).
 */

export type JourneyStepId = "idea" | "project" | "research" | "validate" | "decide" | "plan" | "launch" | "customers" | "measure";

/** Where a step happens. Project-scoped steps open the tab of the user's most recent project. */
export type StepLink = { label: string; href: string } | { label: string; projectTab: string };

export type JourneyStep = {
  id: JourneyStepId;
  title: string;
  summary: string;
  why: string;
  howTo: string[];
  links: StepLink[];
  youGet: string;
  doneWhen: string;
  cost: string;
  tip?: string;
};

export type JourneyPhase = { id: string; title: string; subtitle: string; steps: JourneyStep[] };

export const JOURNEY: JourneyPhase[] = [
  {
    id: "discover",
    title: "Discover",
    subtitle: "Find a problem worth solving",
    steps: [
      {
        id: "idea",
        title: "Find an idea worth building",
        summary: "Start from real pain people already talk about, generate ideas that fit your skills, or bring your own idea.",
        why: "Most products fail because nobody needs them. Starting from a real, repeated pain gives you a head start.",
        howTo: [
          "Gold Mine (evidence first): pick a market, check search demand, then mine real discussions for pain points. Ideas come with the sourced quotes behind them.",
          "Discover Ideas: generate ideas matched to your skills, budget and goals. These are hypotheses until you research them.",
          "Already have an idea? Skip ahead and create a project directly.",
          "Compare up to 4 ideas side by side before you commit.",
        ],
        links: [
          { label: "Gold Mine", href: "/app/gold-mine" },
          { label: "Discover Ideas", href: "/app/ideas" },
        ],
        youGet: "A shortlist of ideas, ideally backed by real customer quotes.",
        doneWhen: "You have at least one idea you want to explore.",
        cost: `Gold Mine: ${CREDIT_COSTS.market_expand}–${CREDIT_COSTS.pain_mining} credits per step · Ideas: ${CREDIT_COSTS.idea_generation} credits per batch`,
        tip: "Gold Mine shows where every quote came from. Generated ideas are labelled as hypotheses until research backs them.",
      },
      {
        id: "project",
        title: "Turn it into a project",
        summary: "Every idea you pursue becomes a project. Research, experiments, plans and marketing all live inside it.",
        why: "One place per idea keeps evidence, decisions and next steps together, so nothing gets lost.",
        howTo: [
          "Open an idea and click “Turn into project”, or create one from scratch.",
          "Describe the problem, who has it and how you'd solve it, in a few sentences.",
          "Gold Mine ideas bring their customer quotes into the project's Customer language tab.",
        ],
        links: [
          { label: "New project", href: "/app/projects/new" },
          { label: "My Projects", href: "/app/projects" },
        ],
        youGet: "A project workspace with tabs for each stage.",
        doneWhen: "You have created your first project.",
        cost: "Free",
      },
    ],
  },
  {
    id: "validate",
    title: "Validate",
    subtitle: "Prove people want it before you build",
    steps: [
      {
        id: "research",
        title: "Research the market",
        summary: "One click on “Validate my idea” researches the market with cited sources, maps competitors and their prices, collects what real people say, and ends with a Go / Pivot / Drop verdict.",
        why: "Research tells you what's already known, who you're up against and what's still uncertain, before you spend weeks building.",
        howTo: [
          "Open your project and click “Validate my idea” (about 3 minutes).",
          "Read the verdict and the micro-SaaS fit check: can you build it solo, where your customers talk, what to charge.",
          "Open the Research tab for the full report. Every point is labelled FACT (with a source), ANALYSIS or ASSUMPTION.",
          "Check Competitors and Market voices to reuse your customers' exact words later.",
        ],
        links: [
          { label: "Validate my idea", projectTab: "" },
          { label: "Research tab", projectTab: "research" },
          { label: "Competitors", projectTab: "competitors" },
        ],
        youGet: "A verdict with an evidence score, a sourced report, competitors with prices, real customer quotes and a shareable link.",
        doneWhen: "Your first research report is ready.",
        cost: `${CREDIT_COSTS.full_validation} credits for the full validation (or ${CREDIT_COSTS.research_job} for research alone)`,
        tip: "Research never invents sources. If something can't be backed by a source, it's labelled an assumption.",
      },
      {
        id: "validate",
        title: "Test it with real people",
        summary: "Research shows what's likely; experiments show what's true. Talk to customers or test demand with a landing page.",
        why: "An idea only counts as validated once real people have shown, by what they do, that they want it.",
        howTo: [
          "Open the Validation Lab and create an experiment: customer interviews, a landing-page test, a pre-sale, and more.",
          "Set the success criteria BEFORE you start (for example, “10 of 20 people say this is a top-3 problem”).",
          "Use the AI interview script, then record what people actually said.",
          "Complete the experiment with the real numbers. The result is measured against your criteria.",
        ],
        links: [
          { label: "Validation Lab", href: "/app/lab" },
          { label: "Project validation", projectTab: "validation" },
          { label: "Read: The MVP Playbook", href: "/app/resources/mvp-playbook" },
        ],
        youGet: "Real evidence: interview notes, signups and results compared against your own targets.",
        doneWhen: "You've completed at least one experiment with recorded results.",
        cost: `Interview script ${CREDIT_COSTS.interview_script} · Analysis ${CREDIT_COSTS.interview_analysis} · Landing copy ${CREDIT_COSTS.landing_copy} credits`,
        tip: "Only real experiment results can mark an idea as validated. AI output never does.",
      },
      {
        id: "decide",
        title: "Decide: build, pivot or drop",
        summary: "Look at the evidence and make a clear call. Dropping a bad idea early is a win.",
        why: "Writing your decision down, and why you made it, stops you drifting for months on an idea that isn't working.",
        howTo: [
          "Open the project's Validation tab and review the summary of your experiments.",
          "Choose Build, Pivot or Drop and write a short note explaining why.",
          "Pivoting? Update the project description and run another experiment.",
        ],
        links: [{ label: "Record decision", projectTab: "validation" }],
        youGet: "A recorded decision tied to the evidence behind it.",
        doneWhen: "A decision is recorded on a project.",
        cost: "Free",
      },
    ],
  },
  {
    id: "build",
    title: "Build & launch",
    subtitle: "Plan the smallest product and go live",
    steps: [
      {
        id: "plan",
        title: "Plan your MVP and business model",
        summary: "Turn what you learned into the smallest product worth shipping and a way to make money from it.",
        why: "A focused MVP gets you to real users in weeks, not months. A pricing hypothesis gives you something to test from day one.",
        howTo: [
          "Open the project's Plan tab.",
          "Generate a business model: customers, value, pricing hypotheses, costs and risks.",
          "Generate an MVP plan: must-have features, what to leave out, milestones and how to build it with your skills.",
          "Edit it to fit you. The plan is a starting point, not a contract.",
        ],
        links: [
          { label: "Plan tab", projectTab: "plan" },
          { label: "Read: The MVP Playbook", href: "/app/resources/mvp-playbook" },
        ],
        youGet: "A business model and a milestone-by-milestone MVP plan.",
        doneWhen: "You've generated an MVP plan or business model.",
        cost: `Business model ${CREDIT_COSTS.business_model} · MVP plan ${CREDIT_COSTS.mvp_plan} credits`,
      },
      {
        id: "launch",
        title: "Launch your waitlist page",
        summary: "Publish a landing page so people can sign up before (and while) you build.",
        why: "A live page turns interest into emails you can contact, and gives every marketing channel somewhere to send people.",
        howTo: [
          "In the project's Validation tab, create a landing page. The AI drafts copy from your research.",
          "Edit the headline and bullets so they use your customers' own words.",
          "Click Publish. You get a public link with a signup form.",
          "Watch visits and signups come in, attributed to each channel.",
        ],
        links: [{ label: "Landing pages", projectTab: "validation" }],
        youGet: "A public page with a waitlist that collects real signups.",
        doneWhen: "A landing page is published.",
        cost: `AI copy draft: ${CREDIT_COSTS.landing_copy} credits`,
      },
    ],
  },
  {
    id: "grow",
    title: "Grow",
    subtitle: "Get your first customers and learn what works",
    steps: [
      {
        id: "customers",
        title: "Get your first customers",
        summary: "Get a go-to-market plan: ranked organic channels, every ad platform assessed, ad copy, and a week-by-week playbook.",
        why: "Customers don't find new products on their own. A focused plan tells you where your audience is and what to say.",
        howTo: [
          "Open the project's Marketing tab and create a marketing plan.",
          "Strategy: check your audience segments and messaging angles.",
          "Organic: start with the top-ranked channel, using its tactics and ready-made drafts.",
          "Paid ads: if you have budget, run the suggested small test on a “Test first” platform.",
          "Work through the playbook week by week and tick off each step.",
        ],
        links: [
          { label: "Marketing tab", projectTab: "marketing" },
          { label: "Marketing Studio", href: "/app/marketing" },
        ],
        youGet: "A detailed plan with channels, ad copy, content drafts and tracking links.",
        doneWhen: "You've created a marketing plan.",
        cost: `${CREDIT_COSTS.marketing_plan} credits per plan`,
        tip: "The plan never states ad benchmarks or results as facts. Budgets are suggestions, so set your own limits before spending.",
      },
      {
        id: "measure",
        title: "Measure and double down",
        summary: "Track which channel actually brings signups and customers, then put more time into what works.",
        why: "Your first channels are guesses too. Real numbers show where to focus.",
        howTo: [
          "Share a different tracking link in each channel. Signups are attributed automatically.",
          "Log spend, visits, signups and customers per channel from your dashboards.",
          "Compare cost per signup, keep the best channel and drop the worst.",
          "Go back to Validate whenever the numbers surprise you.",
        ],
        links: [{ label: "Results", projectTab: "marketing" }],
        youGet: "Real results per channel, with cost per signup calculated from your own numbers.",
        doneWhen: "You have a real signup or a logged channel result.",
        cost: "Free",
      },
    ],
  },
];

export const JOURNEY_STEPS: JourneyStep[] = JOURNEY.flatMap((p) => p.steps);

export type JourneyProgress = Record<JourneyStepId, boolean>;

/** First step not done yet, or null when the whole journey is complete. */
export function nextStep(progress: JourneyProgress): JourneyStep | null {
  return JOURNEY_STEPS.find((s) => !progress[s.id]) ?? null;
}

export function resolveLink(link: StepLink, projectId: string | null): { label: string; href: string } {
  if ("href" in link) return link;
  return { label: link.label, href: projectId ? `/app/projects/${projectId}${link.projectTab ? `/${link.projectTab}` : ""}` : "/app/projects" };
}
