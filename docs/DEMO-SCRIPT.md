# Startum: demo video (2:37)

Everything shown was built during the Meta Global AI Developer Hackathon (Oct 27 – Nov 4). Pre-hackathon parts of
Startum (the original research pages, Gold Mine, the marketplace) are not shown. The footage is the real app,
recorded from one run: a garage video → Traditional → Innovative → a project the Validation Autopilot validated,
branded and launched → designs, prototype and code → a launch video. That run took 10 minutes and cost $0.87 of
Meta API.

The video has on-screen captions, so it works muted. To add a voice-over, read each row at a calm pace (about 140
words a minute); the times match the cut.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 | Hook card over a garage clerk on the phone with paper job cards. | Every software business starts with someone doing a job the slow way: paper, phone calls, spreadsheets. |
| 0:10 | Startum × Meta. Muse Spark, Muse Spark Open, Muse Image, Muse Voice, SAM 3.1. "Built during the hackathon." | Startum turns that moment into a launched product, and every step runs on Meta's models. All of it built during this hackathon. |
| 0:17 | Traditional → Innovative: the video, a procedure PDF and a photo are uploaded; the scan starts and frames are pulled from the video. | Here's a garage that runs on paper. I film it, add the procedure PDF, and Startum pulls frames from the video while Muse Voice transcribes what's said. |
| 0:31 | The scan: five manual steps, each citing "frame 7s" or "PDF p. 1"; seven software ideas tied to the steps they replace; Start project. | Muse Spark maps how the work is done today and cites the exact frame or page it saw. Then it proposes the software that replaces it. One click, and the idea is a project. |
| 0:53 | Enterprise mode: oil & gas, North Africa. Architecture, integrations, compliance, a 90-day pilot. | It works for hard industry problems too, like oil and gas: full systems, with the regulations and a pilot plan. |
| 1:03 | Validation Autopilot: Build, 62% confidence; evidence for and against with sources; the agent's trace. | Now the Validation Autopilot, a Muse Spark agent with real tools, researches the market, competitors and real customer quotes, searches the web, and decides: build, pivot or drop. Every reason links to a source it read. |
| 1:26 | Brand: the Pingup logo by Muse Image, cut out by SAM 3.1; the live waitlist page. | It designs the brand with Muse Image and SAM, and puts a waitlist page live to test real demand. |
| 1:39 | Design: four screens in one design system; the clickable prototype; the generated Next.js code, type-checked. | Muse Spark designs every screen, links them into a clickable prototype, and after approval writes a runnable Next.js app that's type-checked and runs on StackBlitz. |
| 2:07 | Launch video playing; posts for LinkedIn, Instagram, TikTok. | Then the launch: a vertical video built from real customer quotes, with a post for every platform. |
| 2:15 | Switch to Arabic: the app turns right-to-left and translated; dark mode. | And Startum speaks your language: Muse Spark Open, Meta's open-weights model, translates the whole app on the fly. |
| 2:28 | End card: validated · branded · designed · coded · launched; about 10 minutes; under $1; 13 features. | From a phone video to a launched product in ten minutes, for under a dollar. Startum. Try it at startum.website. |

## Re-recording

The footage is recorded by `.e2e/rec.mjs` (headless Chrome screencast, captions drawn on the page) from the scene list
in `.e2e/scenes.mjs`, and the title cards are HTML pages recorded the same way. These helpers are local and not part of
the app.

## Full product tour (4:29)

A longer walkthrough of all 13 hackathon features, for judges who want to see everything. The official submission
video stays the 2:37 cut above (the limit is 3 minutes); link the tour from the README and the submission notes.
Like the short cut, it shows only work built during the hackathon.

| Time | Chapter | On screen |
|---|---|---|
| 0:00 | Hook + intro | Paperwork garage; Startum × Meta, five models |
| 0:17 | 1 · Find the idea | Traditional → Innovative upload and scan · enterprise oil & gas · Copilot ideas with Create project / Validate · Pitch it out loud → a project whose Autopilot verdict is Pivot |
| 1:37 | 2 · Validate | Validation Autopilot (Build, 62%) · voice interview with who-said-what and playable quotes · page review of a competitor's pricing page |
| 2:30 | 3 · Brand & plan | Muse Image + SAM 3.1 brand · live waitlist page · launch playbook (code-computed revenue maths, six gated stages) |
| 3:08 | 4 · Build & launch | Designed screens · clickable prototype · generated Next.js code · launch video and platform posts |
| 3:47 | 5 · For everyone | Ctrl K search · notifications · Arabic right-to-left · dark mode |
| 4:11 | Under the hood | Which Meta model does what; a full product journey ≈ $0.87 |
| 4:20 | End card | ~10 minutes, under $1, 13 features |
