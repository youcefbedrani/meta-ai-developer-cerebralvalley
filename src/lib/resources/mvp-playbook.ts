/*
 * "The MVP Playbook": an original guide to testing an idea with the least
 * time and money. Written for this product. Each strategy links to the tool
 * in the app that helps you run it. Plain data so the page, the help
 * assistant and tests all read the same source.
 */

export type ResourceLink = { label: string; href: string };

export type LadderRung = { name: string; time: string; learn: string; link?: ResourceLink };

export type MvpStrategy = {
  id: string;
  name: string;
  oneLiner: string;
  speed: "hours" | "days" | "1–2 weeks";
  bestWhen: string;
  steps: string[];
  measure: string;
  pitfalls: string[];
  /** Skill tags (lower-case) that make this strategy a natural fit. */
  fitsSkills: string[];
  link: ResourceLink;
};

export const MVP_PLAYBOOK = {
  slug: "mvp-playbook",
  title: "The MVP Playbook",
  subtitle: "Test your idea in days, not months. Get the most information for the least time and money.",
  readMinutes: 12,

  intro: [
    "The costliest mistake a solo founder can make isn't a bad launch. It's spending a year building something nobody wanted.",
    "Your time is the scarcest thing you have. Every week spent building without feedback from the market is a week of risk you can't get back. This playbook shows how to get real signals fast, before you write much code, or any.",
  ],

  whatIsAnMvp: {
    definition:
      "A Minimum Viable Product is the smallest thing you can put in front of real people that tests your key assumptions: do they have this problem, do they care enough, and would they pay to solve it?",
    points: [
      "Its job is learning, not revenue (although revenue is the best signal of all).",
      "It should take as little effort and money as possible.",
      "It tells you what to build next, and what not to build.",
    ],
    smallestExample: "“I'm thinking of solving [problem] for [type of person] with [feature] and [feature]. Is this something you deal with? How do you handle it today?”",
    smallestExampleNote: "Even one honest conversation like this tests an assumption with real people. It's a weak MVP, but it's a start, and it costs nothing.",
  },

  mvr: {
    title: "Think MVR: Minimum Viable Representation",
    body: [
      "The word “product” makes people think they need something that fully works. You don't. What you need is something that represents the product well enough for people to react to it: a page, a video, a mockup or a manual service.",
      "Sell the outcome first, with everything stripped back. Skip the logo polish, the growth strategy and the feature list. Focus on one thing: getting information from real potential customers.",
    ],
  },

  ladder: {
    title: "The MVP ladder",
    note: "Roughly ordered from fastest to slowest to create. Start as low on the ladder as you can while still learning what you need.",
    rungs: [
      { name: "A conversation", time: "Minutes", learn: "Whether the problem is real and how people solve it today.", link: { label: "Interview script", href: "/app/lab/new" } },
      { name: "A social post or account", time: "An hour", learn: "Whether the topic gets a reaction from the right people." },
      { name: "A form or survey", time: "An hour", learn: "How common the problem is, and who wants a follow-up call." },
      { name: "A mockup (screenshot or PDF)", time: "A few hours", learn: "Whether people understand the solution at a glance." },
      { name: "A demo video", time: "Half a day", learn: "Whether the solution excites people enough to sign up or share it." },
      { name: "A landing page", time: "A day", learn: "Whether strangers give you their email for it. You can measure this.", link: { label: "Create a landing page", href: "/app/projects" } },
      { name: "A clickable prototype", time: "A few days", learn: "Whether people can use the flow, and where they get stuck." },
      { name: "A free mini-tool", time: "Days", learn: "Whether one slice of the value pulls in users on its own." },
      { name: "A single-feature app", time: "1–3 weeks", learn: "Whether people come back and use the core feature." },
      { name: "A full app", time: "Months", learn: "Everything, but by far the most expensive way to learn it." },
    ] satisfies LadderRung[],
  },

  whyAWeek: {
    title: "Why aim to ship something within a week",
    reasons: [
      { title: "Momentum", body: "An idea that stays in your head fades. Something tangible pulls you forward." },
      { title: "Information", body: "Emails, replies, calls and data are the most valuable thing an early founder can have." },
      { title: "Credibility", body: "Showing something real proves to customers, and to yourself, that you build rather than just talk." },
      { title: "Clarity", body: "Having to explain the idea in a page or a video forces you to sharpen it." },
    ],
  },

  risk: {
    title: "Building an MVP is risk management",
    body: [
      "The risk is your time. Six months of building with no customer contact is a big unhedged bet.",
      "Your goal: the most information for the least time and money. Keep asking: “How can I learn the most this week while spending the least?”",
    ],
  },

  example: {
    title: "Two ways to start the same app",
    slow: {
      label: "Build first",
      steps: ["Spend months designing and coding the app", "Launch to silence", "Guess what went wrong", "Rebuild, and hope"],
      result: "Months spent before the first real signal.",
    },
    fast: {
      label: "Represent first",
      steps: [
        "Publish a landing page for the upcoming app in a day",
        "Share it with your network, in communities and with potential customers",
        "Collect emails on a waitlist",
        "Talk to the people who signed up: which features matter, and which would they pay for?",
        "Build only those features, with an audience waiting",
      ],
      result: "A real signal within days, and a launch that has demand on day one.",
    },
  },

  bySkill: {
    title: "Pick the MVP that plays to your strengths",
    note: "There's no single right answer. Choose the format that gets you information fastest given what you're already good at.",
    rows: [
      { skill: "Video or editing", mvp: "A demo video that shows what you plan to build", tags: ["video", "editing", "youtube", "content"] },
      { skill: "Writing", mvp: "A landing page or long-form letter with persuasive copy", tags: ["writing", "copywriting", "content", "marketing"] },
      { skill: "Coding", mvp: "A free mini-tool built in a day or two that delivers a small slice of the value", tags: ["coding", "programming", "javascript", "typescript", "python", "react", "developer", "engineering"] },
      { skill: "Design", mvp: "A polished landing page or clickable mockup that shows the idea", tags: ["design", "ui", "ux", "figma"] },
      { skill: "An existing audience", mvp: "A short survey that leads to booked calls", tags: ["audience", "community", "newsletter", "social media"] },
      { skill: "Sales or networking", mvp: "Direct conversations and a manual pilot with a few customers", tags: ["sales", "networking", "business development", "consulting"] },
    ],
  },

  strategies: [
    {
      id: "early-access",
      name: "The early-access page",
      oneLiner: "A simple page with a clear promise and a “Get early access” email form. Nothing is built yet.",
      speed: "days",
      bestWhen: "You can describe the outcome clearly and have somewhere to share the link.",
      steps: [
        "Write a headline that names the benefit and the pain it removes (e.g. “Get [benefit] without [pain]”).",
        "Add 3–5 short benefit bullets in your customers' own words.",
        "Add one call to action: “Join the waitlist” or “Get early access”.",
        "Share it with your network, in relevant communities and directly with potential customers.",
        "Email everyone who signs up and ask for a 15-minute chat.",
      ],
      measure: "Visit → signup rate per channel, and how many signups agree to talk.",
      pitfalls: ["Don't invent testimonials or user counts. Show a real waitlist count, or nothing.", "Don't spend days on design. A clean template is enough."],
      fitsSkills: ["design", "writing", "copywriting", "marketing"],
      link: { label: "Build a landing page", href: "/app/projects" },
    },
    {
      id: "squeeze",
      name: "The squeeze page",
      oneLiner: "An extremely minimal page whose only job is to capture an email, sometimes in exchange for something useful.",
      speed: "hours",
      bestWhen: "You want the fastest possible demand signal, or you can offer a lead magnet (template, checklist, report).",
      steps: [
        "One headline and one sentence that explains exactly what it is.",
        "Optionally show a sneak peek: 3–4 small visuals of planned features.",
        "Offer a lead magnet if you have one (e.g. a free template that solves part of the problem).",
        "Spend most of your time driving people to it and talking to the ones who sign up.",
      ],
      measure: "Signup rate, and what people tell you when you follow up.",
      pitfalls: ["A lead magnet can attract freebie seekers, so qualify people when you follow up."],
      fitsSkills: ["writing", "marketing"],
      link: { label: "Build a landing page", href: "/app/projects" },
    },
    {
      id: "letter",
      name: "The letter (or manifesto)",
      oneLiner: "A plain, text-first page that explains the problem, why current options fail and what you're going to do about it.",
      speed: "days",
      bestWhen: "Your idea takes some explaining, or has a mission people can rally around.",
      steps: [
        "Write it like a letter to one specific reader who has the problem.",
        "Describe the pain honestly, why existing tools fall short, and your approach.",
        "End with a clear ask: join the waitlist, reply or book a call.",
        "Post it where your audience reads long-form (forums, newsletters, communities), following each one's rules.",
      ],
      measure: "Shares, replies and signups from each place you post it.",
      pitfalls: ["Keep it about the reader's problem, not your biography."],
      fitsSkills: ["writing", "copywriting", "content"],
      link: { label: "Get content drafts", href: "/app/marketing" },
    },
    {
      id: "demo-video",
      name: "The demo video",
      oneLiner: "A short screen recording or explainer that shows what you'll build. It can be a rough prototype or just slides.",
      speed: "days",
      bestWhen: "The value is easier to show than to explain, or you're comfortable on camera or editing video.",
      steps: [
        "Record a 1–3 minute walkthrough of the problem and your planned solution (a quick screen recording is fine).",
        "Put it on your landing page above the signup form.",
        "Post it natively on the social platforms your audience uses. Videos double as marketing.",
        "Tag or share it in places where the right technical or niche audience will see it.",
      ],
      measure: "Views to signups, replies and shares.",
      pitfalls: ["Don't show features that don't exist as if they're live. Say it's a preview."],
      fitsSkills: ["video", "editing", "content", "youtube"],
      link: { label: "Plan your launch content", href: "/app/marketing" },
    },
    {
      id: "free-tool",
      name: "The free tool",
      oneLiner: "A tiny, no-login tool that solves one small slice of the problem, as a test for the bigger product.",
      speed: "1–2 weeks",
      bestWhen: "You can code quickly, and a slice of the value works on its own (calculators, generators, checkers).",
      steps: [
        "Pick the smallest useful slice of your idea that can work without accounts.",
        "Build it in a day or two. Ugly is fine if it works.",
        "Ask happy users for their email (e.g. “Get notified when the full version launches”).",
        "Share it where people love trying new tools.",
      ],
      measure: "Users, repeat use, and the share of users who leave an email.",
      pitfalls: ["It may never make money by itself. Its job is to reach your market and start conversations."],
      fitsSkills: ["coding", "programming", "developer", "javascript", "typescript", "python"],
      link: { label: "Plan the MVP", href: "/app/projects" },
    },
    {
      id: "ad-test",
      name: "The ad test",
      oneLiner: "Skip the build and test demand directly with a small paid ad that leads to a signup or booking form.",
      speed: "days",
      bestWhen: "You can afford a small test budget and want a fast, measurable answer.",
      steps: [
        "Decide your maximum cost per lead BEFORE you spend anything.",
        "Write 2–3 ad variants, each testing a different angle from your research.",
        "Send clicks to your landing page, or to the platform's own lead form.",
        "Call or email the leads. The conversation is the real validation.",
        "Stop or continue based on the rule you set, not on gut feeling.",
      ],
      measure: "Cost per lead or signup against your own threshold, and how many leads turn into conversations.",
      pitfalls: ["Results vary widely by market. Don't trust anyone's “typical” numbers, including your own guesses.", "Follow each platform's ad policies. Avoid guarantees and claims about health, finance or personal attributes."],
      fitsSkills: ["marketing", "ads", "growth"],
      link: { label: "Build an ad test", href: "/app/marketing" },
    },
    {
      id: "concierge",
      name: "The concierge / “Wizard of Oz” MVP",
      oneLiner: "From the outside it looks like a working service. Behind the scenes, you do the work by hand.",
      speed: "hours",
      bestWhen: "The service can be delivered manually at a small scale, and you want to learn the real workflow before automating it.",
      steps: [
        "Put up a simple page with a request form.",
        "Drive a little traffic to it (a search ad on a high-intent keyword works well).",
        "When a request comes in, deliver the result yourself, manually.",
        "Write down every step you repeat. That list is your future product spec.",
      ],
      measure: "Requests, completed deliveries, repeat customers and willingness to pay.",
      pitfalls: ["Only take money for what you can actually deliver.", "Don't build automation until the manual process is proven and painful."],
      fitsSkills: ["sales", "operations", "consulting", "customer service"],
      link: { label: "Set up an experiment", href: "/app/lab/new" },
    },
    {
      id: "pre-sale",
      name: "The pre-sale",
      oneLiner: "Ask for a real commitment, such as a founding-member price, deposit or paid pilot, before you build.",
      speed: "1–2 weeks",
      bestWhen: "You've had good conversations and want the strongest proof possible: money.",
      steps: [
        "Offer a clear founding-member deal (lower price, direct input on the roadmap).",
        "State honestly what exists today and when it will be ready.",
        "Offer a refund if you don't deliver.",
        "Record every pre-sale as experiment results.",
      ],
      measure: "Paid commitments compared with the number of people asked.",
      pitfalls: ["Be transparent about timelines, and refund promptly if plans change."],
      fitsSkills: ["sales", "business development", "networking"],
      link: { label: "Record a pre-sale experiment", href: "/app/lab/new" },
    },
  ] satisfies MvpStrategy[],

  landingChecklist: {
    title: "What every MVP landing page needs",
    items: [
      { title: "Headline and hook", body: "Make the value obvious in one line, e.g. “Get [benefit] without [pain]”." },
      { title: "Benefits", body: "3–5 bullets about what's in it for them, in your customers' words." },
      { title: "Honest social proof", body: "Only real proof: an actual waitlist count, a real quote you have permission to use. Never invent it." },
      { title: "One call to action", body: "“Join the waitlist” or “Get early access”. Make it the only thing to click." },
      { title: "A way to capture information", body: "An email form, a booking link or a short form. Even one email is one conversation." },
    ],
  },

  closing:
    "Don't try every strategy at once. Pick the one that fits your skills and situation, run it this week, and let what you learn decide the next step.",
} as const;

/** Strategies ranked for a founder's skills (exact tag matches first); stable order otherwise. */
export function strategiesForSkills(skills: string[]): MvpStrategy[] {
  const mine = skills.map((s) => s.toLowerCase());
  const score = (s: MvpStrategy) => s.fitsSkills.filter((t) => mine.some((m) => m.includes(t) || t.includes(m))).length;
  return [...MVP_PLAYBOOK.strategies].map((s, i) => ({ s, i, n: score(s) })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.s);
}

/** Plain-text digest of the playbook, used to ground the help assistant. */
export function playbookDigest(): string {
  const p = MVP_PLAYBOOK;
  return [
    p.title,
    p.whatIsAnMvp.definition,
    p.mvr.body.join(" "),
    `Ladder: ${p.ladder.rungs.map((r) => `${r.name} (${r.time})`).join("; ")}`,
    p.risk.body.join(" "),
    ...p.strategies.map((s) => `${s.name}: ${s.oneLiner} Best when: ${s.bestWhen} Steps: ${s.steps.join(" ")} Measure: ${s.measure}`),
    `Landing page: ${p.landingChecklist.items.map((i) => `${i.title}: ${i.body}`).join(" ")}`,
  ].join("\n");
}
