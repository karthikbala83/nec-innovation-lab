# NEC Innovation Lab

**Nandha Engineering College's own project portal.** Every student and team launches their project here — problem, solution, live demo, video, code — on the college domain. Visitors back and follow projects like a startup portal; recruiters see proof the college stands behind.

> Built and seeded by **Saravonix Technologies Pvt. Ltd.**, maintained by the NEC student tech club with faculty owners.

---

## Why a college portal

| A student today | On NEC Innovation Lab |
|---|---|
| Project is one line on a resume | A live launch page on the college domain |
| Has to buy a domain and hosting to look credible | The college hosts it; one profile URL + QR for every resume |
| Interviewer can't tell if AI wrote the code | Questions generated from the student's own code, answered and scored on the college platform, faculty viva |
| No one sees the project after SIH | Feed, leaderboards, backers, demo days |

Full product spec: **[docs/PORTAL_SPEC.md](docs/PORTAL_SPEC.md)**

---

## What's in this repo today

| Path | What it is |
|---|---|
| `server/`, `client/` | MERN app: own JWT auth + the P0 portal in feature folders (`projects/`, `feed/`, `review/`, `profiles/`). The starter's `notes` demo is kept for teaching. |
| `docs/PORTAL_SPEC.md` | What we are building, phases P0–P3 |
| `docs/STARTER.md` | How the base app works, run locally, **deploy on free tiers** (Atlas + Render + Vercel) |
| `docs/git-merge-lab.html` | Animated Git lesson: branch, merge, resolve a conflict — open in any browser |
| `CONTRIBUTING.md` | How students contribute (branches, PRs, reviews) |
| `CLAUDE.md` | Conventions for AI-assisted coding in this repo |

## Run locally

```bash
cd server && cp .env.example .env && npm install && npm run seed && npm run dev   # http://localhost:5000
cd client && cp .env.example .env && npm install && npm run dev                   # http://localhost:5173
```

`npm run seed` **wipes the database** and loads demo data: an admin, two faculty mentors, seven students (all on `ALLOWED_EMAIL_DOMAIN`), three published projects and one waiting in the mentor queue. Logins are printed at the end of the seed. Run server unit tests with `cd server && npm test`.

Details: [docs/STARTER.md](docs/STARTER.md). **Deploying (Netlify + Railway + Atlas + S3): [docs/DEPLOY.md](docs/DEPLOY.md).**

## P0 at a glance

| Who | Where | What |
|---|---|---|
| Anyone | `/` | Feed: New launches / Trending this week, filters, search |
| Anyone | `/p/<slug>` | Launch page: story, video, team, code panel (stack, languages, commits per week) |
| Anyone | `/u/<handle>` | Student profile + resume QR. No email, phone or roll number shown |
| Student | `/projects/new` | 6-step wizard: basics, story, links, team + mentor, GitHub import, submit |
| Faculty | `/review` | Approval queue. Nothing is public until the mentor approves |
| Admin | `/admin/people` | Promote faculty, mark students verified |

## P1 at a glance

| Who | Where | What |
|---|---|---|
| Signed-in users | launch page | 👏 Back (one per person, college vs public counted apart), Follow, comment + reply, report |
| Faculty / anyone | launch page | Offer to mentor (faculty) · Offer a pilot (badge after admin confirms) |
| Team | launch page, wizard | Update timeline · up to 3 "Looking for" asks |
| Anyone | launch page | Performance panel: Lab Score 0-100 with all six parts and the reason for each |
| Anyone | `/leaderboards` | Lab Score · Most backed · Most active repo · Best uptime, by department |
| Admin | `/admin/lab` | Score weights (must total 100, re-scores everything), confirm pilots, reported comments, run daily checks |

## P2 at a glance

| Who | Where | What |
|---|---|---|
| Student | launch page → *Take your Lotus check* | 24 questions (8 petals × 3 levels) built **from their own code** by the Saravonix Lotus API; answers private; scored 0-3 with feedback |
| Faculty mentor | `/review` → *Lotus & viva* | Read answers, override scores, mark **viva done** → page shows "Viva by Dr. X on <date>" + Verified |
| Anyone | launch page, profile | Lotus flower per member (petals filled). Never the answers |
| Mentor / admin | review queue, launch page | **Duplicate check**: > 60% identical files to another college project is flagged (boilerplate ignored; never public) |
| Recruiter | `/talent` | Students by stack, stage, department, Lotus petals, viva-verified; **Request intro** goes to the placement cell |
| Placement cell (admin) | `/admin/people`, `/admin/intros` | Invite recruiters (one-time set-password link); forward / decline intro requests |

## App tour

First login shows a short guided tour for the user's role (student, faculty, recruiter, admin): it spotlights the real buttons, moves between pages, and on phones opens the menu and docks the card at the bottom. Replay any time with the floating **?** button. Finishing or skipping is saved on the account (`tourVersion`), so it won't repeat on another device. Steps live in `client/src/tour/tourSteps.js` — bump `TOUR_VERSION` to show a changed tour to everyone again.

## Likes, feedback & project requests

| Who | What |
|---|---|
| Anyone with the link (no account) | ♡ **Like**; **Give feedback** (1–5 stars) or **Need one like this?** (a project request) after giving name, email and mobile — the email is proved with a 6-digit code |
| Classmates / faculty (signed in) | Feedback straight away — the college account is the proof |
| Team | **Share for feedback** (WhatsApp / copy link); `/inbox` with replies; replies are emailed to the sender through the portal |
| Sender | Gets a private link by email to read replies and answer back — no account |
| Admin | `/admin/moderation`: messages the content check held back; deliver or reject |

**Content check** (`server/moderation/contentCheck.js`, word lists in `wordlists.js`): runs before anything is stored or emailed. Rejects abuse (English, Tamil and Hindi in Latin letters, leetspeak), harassment, threats, scams/adverts, phone numbers / emails / social handles in the message, repeated text. Holds for an admin: off-topic messages, a link, mild insults, shouting, Tamil-script text. Comments and replies use the same rules. Students never see a visitor's email or phone, and visitors never see a student's. Email goes through Resend (`RESEND_API_KEY`, `MAIL_FROM`).

Lotus runs at Saravonix (`LOTUS_API_URL`, `LOTUS_API_KEY`); this repo only holds the thin client `server/services/lotusClient.js`. Contract: [docs/LOTUS_API.md](docs/LOTUS_API.md). In development a clearly labelled mock stands in.

**Lab Score** (`server/score/labScore.js`): Understanding 35 (team's Lotus average, members who haven't taken it count 0, + up to 10 for vivas) · Build activity 15 · It works 15 · Community 15 · Recognition 15 · Freshness 5. Weights live in the `settings` collection.

**Daily checks** (`server/jobs/dailyChecks.js`): ping live URLs (private/internal addresses are refused, so students can't use it to probe the network), refresh repos when `GITHUB_TOKEN` is set, re-score everything. Runs inside the API every ~24 h, or `npm run daily` from a cron.

**GitHub import** (`server/projects/repoImport.js`): public repos only, server token (`GITHUB_TOKEN`), cached for `GITHUB_CACHE_MINUTES`. One tarball download instead of one call per file; skips `node_modules`, builds, lockfiles, binaries and files over 500 KB; scans for committed keys (masked, shown only to the team, mentor and admin); maps commits to members by GitHub username.

## Roadmap

| Phase | Delivers |
|---|---|
| P0 | College-email login, project launch pages, GitHub import, mentor approval, home feed, student profile + QR |
| P1 | Back / follow / comment, update timeline, Performance panel + Lab Score, leaderboards |
| P2 | Lotus Blossom understanding check, faculty viva, duplicate check, recruiter intro requests |
| P3 | Seasons & Demo Day, admin reports, custom domain + Docker |

## Who maintains it

| Role | People |
|---|---|
| Owners | NEC faculty (to be named) |
| Maintainers | NEC student tech club — see `.github/CODEOWNERS` |
| Upstream & mentor | Saravonix Technologies (KB) |

---
*MIT licensed. © 2026 Saravonix Technologies Pvt. Ltd. — Built Right. Held Secure.*
