# Submission kit (Meta Global AI Developer Hackathon)

Copy-paste material for the Cerebral Valley submission form and the X post. Facts match [HACKATHON.md](../HACKATHON.md).

## Project name
Startum — check your SaaS idea before you build it

## Track / problem statement
Startup track · Build for Your World

## One-liner
A Muse Spark agent that takes a founder's spoken idea, researches the market, cites a real source for every reason, and decides Build, Pivot or Drop — then designs the brand and a landing page to test demand.

## Description (short)
Most first-time founders spend months building something nobody wants. Startum makes them find out first.
During the hackathon we rebuilt it around Meta's models:

- **Validation Autopilot** (Muse Spark tool calling): an agent with nine tools — market research, competitor scan, forum mining, web search, business model, MVP plan, brand, landing page, verdict. Every reason in its verdict must cite a URL the agent actually read during the run; anything else is discarded and weak verdicts are sent back.
- **Pitch it out loud** (Muse Voice Transcribe + Muse Spark): speak the idea, get a project and an Autopilot run focused on your own question.
- **Voice interviews** (Muse Voice Transcribe diarization): upload a customer interview, get who said what, verified quotes that play back from the moment they were said.
- **Brand visuals** (Muse Spark art director + Muse Image + SAM 3.1): research-grounded logo, landing hero and channel ads; SAM 3.1 cuts the logo out to a transparent PNG.
- **Page review** (Muse Spark vision): screenshot critique of your landing page or a competitor's, with each issue pinned on the image.
- Every existing Startum feature now runs on Muse Spark with native JSON Schema output, plus an optional route to Muse Spark Open on Baseten/Modal/vLLM.

Measured: from a bare idea to a BUILD verdict with business model, MVP plan, brand, 5 visuals and a branded landing page in 4 min 55 s for $0.47.

## What was built during the hackathon
Everything listed above. The pre-hackathon product is tagged `pre-hackathon-baseline`; all hackathon commits are prefixed `Hackathon:` — see HACKATHON.md for the file-by-file list.

## Links
- Repo: https://github.com/youcefbedrani/meta-ai-developer-cerebralvalley
- What we built: https://github.com/youcefbedrani/meta-ai-developer-cerebralvalley/blob/main/HACKATHON.md
- Diff since the baseline: https://github.com/youcefbedrani/meta-ai-developer-cerebralvalley/compare/pre-hackathon-baseline...main
- Demo video: _(upload, then paste the link)_
- Live product: _(after deploy)_

## X post (for the Most Viral prize — post with the demo video attached)
I pitched a startup idea out loud.

5 minutes later an AI agent had researched the market, checked competitor prices, written a business model + MVP plan, designed the brand and built a landing page — and told me BUILD, with a real source for every reason.

Built on Meta's Muse Spark, Muse Image, SAM 3.1 and Muse Voice Transcribe for the Meta Global AI Developer Hackathon 👇 [tag the official account + hashtag from the hackathon Discord #announcements]

[video]

Repo: github.com/youcefbedrani/meta-ai-developer-cerebralvalley

## X thread follow-ups
1. The agent can't make things up: every reason in its verdict must cite a URL it actually read during the run. No source → the reason is thrown out. (screenshot: verdict card)
2. The brand is 3 Meta models working together: Muse Spark writes the art direction from real customer quotes, Muse Image renders, SAM 3.1 cuts the logo out. (screenshot: brand visuals)
3. Drop in a competitor's pricing page and Muse Spark's vision pins their weak spots right on the screenshot. (screenshot: page review)
