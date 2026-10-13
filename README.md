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
| `server/`, `client/` | MERN base: own JWT auth, protected routes, MongoDB aggregation examples, admin dashboard. The portal is built on top of this. |
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

Details and deployment: [docs/STARTER.md](docs/STARTER.md).

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
