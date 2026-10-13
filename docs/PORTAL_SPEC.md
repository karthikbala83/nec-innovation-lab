# NEC Innovation Lab — Product Spec v0.2

**Owner (product):** Nandha Engineering College · **Built & seeded by:** Saravonix Technologies (KB)
**Status:** Draft · 13 Oct 2026 · supersedes "Enovix Showcase v0.1"
**Stack:** MERN, starting from this repo's starter code (thin routes, controllers do the work, models own the data rules)

---

## 1. The idea in one paragraph

Every student or team at the college launches their project on **one portal that the college owns and runs on its own domain** (e.g. `innovation.nandha.ac.in`). Visitors browse it like a **startup or crowdfunding portal**: a feed of project launch pages they can back, follow and comment on, with live performance numbers. Because the page sits on the college domain, the student's identity is checked by the college, the code history is pulled from GitHub, and the understanding questions were set and scored on the college's platform, **an interviewer can trust it** in a way they cannot trust a personal site. Students stop hunting for domains and hosting just to look credible.

---

## 2. Why the college domain matters

| Proof an interviewer needs | Personal site / resume line | NEC Innovation Lab |
|---|---|---|
| "Is this really a student of this college?" | Self-claimed | Signed in with college email; roll number checked by admin |
| "Did they build it?" | Self-claimed | GitHub commits mapped per member, timestamped, pulled by the college server |
| "Do they understand it, or did AI write it?" | Unknown | Lotus Blossom questions generated from **their own code**, answered and scored on the college platform; faculty viva mark |
| "Does it work?" | Link may be dead | Live URL checked daily; uptime shown |
| "Did anyone else rate it?" | None | Backers, faculty endorsements, industry feedback, SIH / hackathon stage |
| "Is it current?" | Static | Update timeline (like a startup's launch log) |

The college becomes the **issuer** of the proof, like a certificate, but live.

---

## 3. Who uses it

| Role | Goal | Key actions |
|---|---|---|
| **Student / team** | Launch a project once, link it everywhere | Create launch page, connect repo, post updates, answer Lotus questions, share link + QR |
| **Faculty mentor** | Guide and vouch | Approve for publishing, endorse, run viva, score |
| **College admin** (placement cell / IIC / incubation) | Run the portal, show outcomes | Branding, moderation, seasons/demo days, reports, intro requests |
| **Student tech club** (maintainers) | Keep the code alive | PRs, issues, deploys — the portal is itself their live project |
| **Public visitor** | Browse and back projects | Back, follow, share |
| **Recruiter / industry / investor** | Find talent and ideas | Filter, view performance, **request an intro through the college** |
| **Alumni** | Give back | Mentor, comment, offer pilots |

---

## 4. What the portal looks like (startup-portal pattern)

| Screen | Like | What's on it |
|---|---|---|
| **Home feed** | Product Hunt | Tabs: Trending this week · New launches · Top this semester · SIH 2026. Filters: department, year, theme, stack, stage. Each card: thumbnail, title, tagline, team avatars, backers count, stage badge, live/down dot |
| **Project launch page** | Kickstarter campaign page | Hero video, tagline, **Back this project** + **Follow**, problem, solution, screenshots, live demo button, team with Lotus badges, performance panel (§5), update timeline, "Looking for" asks, comments, faculty endorsement |
| **Student profile** | LinkedIn / Devpost | College-verified badge, department & batch, all projects, Lotus badges, endorsements, one shareable URL + QR for the resume |
| **Leaderboards** | Startup rankings | Per season, per department, per category: most backed, highest Lotus average, most active repo, best uptime |
| **Seasons & Demo Day** | Accelerator batch | "SIH 2026 Season", "Odd Sem 2026 Demo Day": submission window, judging, winners wall |
| **Recruiter view** | Talent search | Filter by stack / Lotus petal strength / stage; "Request intro" goes to the placement cell, never straight to the student |
| **Admin console** | — | Approvals queue, reports, branding, seasons, AI quota, exports |

---

## 5. Performance — what "how is this project doing" means

Shown as a **Performance panel** on every launch page, with a 0–100 **Lab Score** and its parts visible (never a black box).

| Signal | Source | Weight in Lab Score | Shown as |
|---|---|---|---|
| **Understanding** | Lotus Blossom scores of all members, viva bonus | 35% | Lotus flower per member, team average |
| **Build activity** | GitHub commits per week, contributors, last push | 15% | Sparkline, "last commit 3 days ago" |
| **It works** | Live URL daily check, last 30 days | 15% | Uptime % and live dot |
| **Community** | Backers (college + public), followers, views | 15% | Counts, week-over-week trend |
| **Recognition** | SIH stage, hackathon wins, incubation, pilot users | 15% | Badges with dates |
| **Freshness** | Updates posted in last 60 days | 5% | Timeline |

Rules:
- Weights live in tenant config so the college can tune them.
- Backers from college accounts and public visitors are counted separately; public backs are rate-limited and need a light check (email OTP or Google sign-in) to stop spam.
- Leaderboards show the Lab Score **and** its parts, so a project with no likes but a strong Lotus score still stands out.
- Projects in their first 14 days get a "New" label and are ranked on a separate "New launches" tab, so early projects are not buried.

---

## 6. "Back this project" — no money in v1

Crowdfunding-style backing **without payments**. Collecting money for students needs a legal entity, KYC, receipts and refunds; that is a later, college-run decision.

| Backing type | Who | Effect |
|---|---|---|
| 👏 Back | anyone signed in | +1 backer |
| Mentor | faculty, alumni, industry | listed on page as mentor offer, notifies team |
| Pilot | company / department | "Pilot offered by …" badge after admin confirms |
| Internship / interview | recruiter | goes to placement cell as an intro request |
| Incubation | college incubator / IIC | moves project to "Incubation" stage |

Each project can post up to 3 **"Looking for"** asks (teammate with React skills, 20 pilot users, a mentor in agri-tech).

---

## 7. Lotus Blossom understanding check (from v0.1, unchanged in essence)

The project sits at the centre; 8 petals surround it; each petal has 3 levels.

| # | Petal | Grounded in |
|---|---|---|
| 1 | Problem & users | README, problem text |
| 2 | Architecture | file tree, entry points |
| 3 | Data model | models / schemas |
| 4 | API & logic | routes, controllers |
| 5 | Frontend | pages, components |
| 6 | Deployment | env usage, hosting config, live URL |
| 7 | Security | auth code, secret scan results |
| 8 | Scale & next steps | whole repo |

| Level | Asks the student to | Weight |
|---|---|---|
| L1 Explain | describe what existing code does | 1 |
| L2 Modify | change a function or query | 2 |
| L3 Extend | design a feature or fix a real flaw | 3 |

- 24 questions per student, weighted toward files **that student committed**, so teammates get different sets.
- Every question must cite a real file path from the repo snapshot.
- AI scores 0–3 per answer with one line of feedback; faculty can override and mark **Viva done** (shown with the mentor's name — the strongest trust signal).
- Answers are never public. The page shows petals filled, plus "Viva by Dr. X on <date>" when done.
- On the page: "Code walkthrough 6/8 petals". Use "Verified" only after a viva.

---

## 8. Project launch page — fields

| Group | Field | Notes |
|---|---|---|
| Identity | title, slug, tagline (≤140), thumbnail | slug unique per college |
| Category | department, year, theme, `category: software \| hardware \| research` | |
| Stage | `idea → prototype → live → pilot → incubation → startup` | team sets; pilot/incubation/startup need admin confirm |
| Competitions | list of `{ name (SIH 2026, college hackathon…), psId, stage, date }` | "winner" needs admin confirm |
| Story | problem (≤1500), solution (≤2500), impact (≤800), architecture image | |
| Proof | liveUrl, repoUrl (public GitHub), demo video (link or upload), screenshots (≤8) | |
| Team | members[] `{ userId, githubUsername, role }` (≤6), mentorId | |
| Asks | lookingFor[] (≤3) | |
| Updates | timeline posts `{ title, body, media, date }` | |
| State | `draft → in_review → published → archived` | mentor approval moves to published |

---

## 9. GitHub import

Same as v0.1: server-side read-only token (unauthenticated limit is 60 requests/hour per IP — one lab would hit it), cached snapshot, skip `node_modules`/build/lock/binaries/large files, map commits to members, detect stack from `package.json` / `requirements.txt` / config files, **scan for committed secrets and warn the team privately**.

Added in v0.2:
- **Duplicate check:** compare repo file hashes against other projects in the college; flag > 60% overlap to the mentor (not public) — catches copied projects.
- **Activity history:** weekly commit counts stored for the sparkline.

---

## 10. Owned and run by the college

| Topic | Decision |
|---|---|
| Code | This repo, `nec-innovation-lab`. Saravonix seeds it; the college's tech club maintains it via PRs |
| Domain | `innovation.nandha.ac.in` (college IT adds one DNS record) |
| Hosting | Free tiers to start (Vercel + Render + Atlas, as in `docs/STARTER.md`), or `docker compose` on the college server later |
| Logins | College email only for students/faculty; public visitors sign in only to back/comment |
| Media | College-owned S3 / Cloudinary account; video as YouTube unlisted links in v1 to keep cost near zero |
| AI (Lotus) | College's own API key with a monthly cap set in admin — see open decision #1 |
| Moderation | Mentor approves before public; report button; admin can hide |
| Privacy | No phone numbers or personal emails public; recruiter contact only through placement cell |
| Other colleges | Not in scope now. Kept single-college; multi-college is a later fork |

---

## 11. Data model (Mongo)

| Collection | Key fields |
|---|---|
| `users` | existing starter model + role, department, batch, rollNo, githubUsername, verified |
| `projects` | §8 fields, labScore{total, parts}, counts{backers, followers, views} |
| `repoSnapshots` | projectId, sha, meta, languages, tree, keyFiles, commits, weeklyCommits[], memberFiles, secretWarnings, fileHashes |
| `lotusSets` / `lotusAttempts` | as v0.1: questions per member, answers, AI + mentor scores, viva |
| `backings` | projectId, userId, type (back/mentor/pilot/intro/incubation), note, status — unique (projectId, userId, type) |
| `follows` | projectId, userId |
| `comments` | projectId, userId, body, parentId, hidden |
| `updates` | projectId, title, body, media, createdAt |
| `seasons` | name, window, categories, judges, winners[] |
| `introRequests` | from (recruiter), projectId/userId, message, status (placement cell handles) |
| `metricsDaily` | projectId, date, views, backers, uptimeOk, commits — feeds trends & Lab Score |
| `settings` | branding, scoreWeights, aiQuota, domains |

---

## 12. Build phases

| Phase | Scope | Target |
|---|---|---|
| **P0 — Launch pages** | College-email login, project create/edit, repo import, media links, mentor approval, public launch page, home feed (New + Trending), student profile URL + QR | 2–3 weeks |
| **P1 — Startup-portal layer** | Back / follow / comment, updates timeline, "Looking for" asks, Performance panel with Lab Score, leaderboards | +2 weeks |
| **P2 — Trust layer** | Lotus questions + scoring, faculty viva mode, duplicate check, recruiter view + intro requests | +2–3 weeks |
| **P3 — College ops** | Seasons & demo day, admin reports/exports, custom domain + Docker, tech-club handover runbook | +2 weeks |

---

## 13. Acceptance checks (P0–P1)

- [ ] A student signs in with a college email and launches a project in under 10 minutes.
- [ ] Repo import shows stack, per-member commits and any secret warnings within 30 s.
- [ ] Nothing is public until a mentor approves it.
- [ ] Launch page and feed work on a phone at 400 px width; feed loads in under 2 s with 200 projects.
- [ ] One back per signed-in user per project; counts for college vs public shown separately.
- [ ] Lab Score shows each part and matches the weights in settings.
- [ ] Profile URL + QR open the student's projects without login.

---

## 14. Open decisions for KB / the college

1. **Lotus engine ownership.** (a) Fully open inside this repo, college pays its own AI key; or (b) Lotus runs as a Saravonix API the portal calls, so Saravonix keeps the IP and offers it to other colleges. Recommendation: **(b)** — the portal is the college's, the question engine stays a Saravonix service with a free quota for NEC.
2. **Domain name:** `innovation.nandha.ac.in`, `lab.nandha.ac.in`, or other.
3. **Who approves:** mentor only, or mentor + HoD for public visibility.
4. **Public backing:** allow non-college visitors to back from day one, or college-only in P1.
5. **Seasons:** start with "SIH 2026" as the first season?
6. **Real-money funding:** out of scope; revisit only if the college/incubator wants a CSR-backed grant flow.
