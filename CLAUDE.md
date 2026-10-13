# CLAUDE.md — working in this repo

NEC Innovation Lab: Nandha Engineering College's student project portal. Product spec: `docs/PORTAL_SPEC.md` (read it before building a feature).

## Conventions
- MERN. Server: Express + Mongoose in `server/`; client: React + Vite in `client/`.
- Thin routes → controllers do the work → models own validation and indexes. Keep `server.js` as wiring only.
- One axios instance (`client/src/api/axios.js`); auth state in `client/src/context/AuthContext.jsx`.
- New portal features live under `server/` and `client/src/` in feature folders (`projects/`, `feed/`, `lotus/`…), not in the starter's demo `notes` code.
- New env vars go into the matching `.env.example` with a comment. Never commit `.env`.
- Mobile-first UI: every page must work at 400 px width.
- No public personal phone numbers or emails; recruiter contact goes through the placement cell.

## Workflow
- Work on a feature branch, small commits, open a PR into `main`. CI must pass.
- Build phase by phase as in the spec (P0 first). Stop at the end of a phase and list what was built and how to test it.

## Kick-off prompt for P0
> Read docs/PORTAL_SPEC.md. Implement Phase P0: college-email-restricted signup (domain from `ALLOWED_EMAIL_DOMAIN`), roles (student, faculty, admin), `projects` and `repoSnapshots` models, GitHub public-repo import service (token from `GITHUB_TOKEN`, cached, skip rules, secret scan, per-member commit mapping), project create/edit wizard, mentor approval queue, public launch page, home feed (New + Trending), and student profile page with QR. Seed 3 demo projects. Mobile-first. Stop after P0 and summarise.
