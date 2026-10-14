# NEC Innovation Lab — Runbook for the student tech club

You keep the college's project portal running. This page is the "what do I do when…" guide.
Read it once end to end when you join; come back to the section you need.

> Faculty owners: _(to be named)_ · Maintainers: see `.github/CODEOWNERS` · Upstream & mentor: Saravonix Technologies (KB)

---

## 1. How it fits together

| Piece | Where (UAT / free tier) | Where (college server) | Code |
|---|---|---|---|
| Web app (React) | Netlify | `web` container (nginx) | `client/` |
| API (Express) | Railway | `api` container | `server/` |
| Database | MongoDB Atlas, db `nec_innovation_lab` | `mongo` container + volume | `server/**/*.js` models |
| Images | S3 `s3://nec-innovation-lab/students-projects/` | same | `server/services/s3.js` |
| Email | Resend | same | `server/services/mailer.js` |
| Lotus questions | Saravonix Lotus API | same | `server/services/lotusClient.js` (client only) |
| HTTPS / domain | Netlify + Railway | `caddy` container | `deploy/Caddyfile` |

Inside the API, every feature is a folder: `projects/`, `feed/`, `community/`, `feedback/`, `lotus/`, `seasons/`, `reports/`…
Routes are thin; controllers do the work; models hold the rules. Read `CLAUDE.md` and `docs/PORTAL_SPEC.md` before changing anything.

## 2. Making a change (every change)

1. `git switch main && git pull` → `git switch -c feature/<short-name>`
2. Code + run locally (`docs/STARTER.md`). Run `cd server && npm test`.
3. Push, open a PR into `main`. CI must pass (server tests, client build, no `.env` committed). One maintainer review.
4. Merge → Netlify and Railway deploy `main` automatically (watch the deploy logs).
5. Smoke test on UAT: open the feed, open a project, log in as a test user. Check `https://<api>/api/health` → `"ok":true`.

**Never** commit `.env`, `.env.docker`, keys or passwords. If it happens: tell a faculty owner, rotate the key (section 7), then remove it from git.

## 3. Calendar — what to do and when

| When | Task | Where |
|---|---|---|
| Start of each semester | Promote new faculty mentors; check old ones still teach | Admin → People |
| Start of each semester | Create the semester's **Demo Day** season (dates, tracks, judges, rubric) | Admin → Seasons |
| Before SIH / hackathons | Create a **Season** with the event's dates; tell students to enter from the season page | Admin → Seasons |
| Weekly | Clear the feedback moderation queue and reported comments | Admin → Feedback moderation, Admin → Lab Score & moderation |
| Weekly | Placement cell: handle new intro requests | Admin → Intro requests |
| After a season's judging ends | Check every entry has ≥ 2 judges' scores, pick winners, **Publish results** (teams are emailed) | Admin → Seasons → Ranking |
| End of semester | Export reports for HoDs / IIC / NAAC files | Admin → Reports → CSV |
| Monthly | Check Lotus quota usage and email delivery (Resend dashboard) | Admin → Lab Score; resend.com |
| Monthly | Test a backup restore on a spare machine (college server) | section 6 |
| Yearly (June) | Rotate secrets; review maintainers & access (section 8) | |

## 4. Health checks

- **API:** `GET /api/health` → `{"ok":true,"db":"nec_innovation_lab"}`. `503` means the database is not connected.
- **Daily checks** (live URLs, repo refresh, Lab Scores) run inside the API once a day. Admin → Lab Score & moderation shows *Last run*; use *Run daily checks now* if it is older than a day.
- **Railway** → service → Deployments / Metrics. **Netlify** → Deploys. **Atlas** → Metrics (storage, connections).
- College server: `docker compose ps` (all `healthy`), `docker compose logs --tail=100 api`.

## 5. When something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| Site loads, but every page says "Could not load" | API down or CORS | Open `/api/health`. If down: Railway logs / `docker compose logs api`. If up: `CLIENT_URL` must list the exact site URL (no trailing slash). |
| `/api/health` → 503 | DB unreachable | Atlas: Network Access must allow the API's IP (`0.0.0.0/0` for Railway); password changed? College server: `docker compose ps mongo`. |
| Students can't sign up | Wrong `ALLOWED_EMAIL_DOMAIN` | Must be `nandhaengg.org` (comma-separate extra domains). |
| No emails (codes, alerts, resets) | Resend key / domain | Resend dashboard → Logs. `MAIL_FROM` must use a **verified** domain. Visitors can't send feedback until this works. |
| GitHub import: "rate limit reached" | No / expired `GITHUB_TOKEN` | Create a fine-grained read-only token (public repos), set it, redeploy. |
| Lotus: "quota reached" | Monthly quota used | Raise `LOTUS_MONTHLY_QUOTA` after talking to Saravonix, or wait for next month. |
| Lotus pages error on UAT | No Lotus credentials in production | Set `LOTUS_API_URL` + `LOTUS_API_KEY`, or `LOTUS_MOCK=true` on UAT only. |
| Image upload fails | S3 CORS / IAM | Bucket CORS must list the site URL; IAM user needs `s3:PutObject` on `students-projects/*`. |
| A message or comment is abusive | Got past the word lists | Hide it (Admin → moderation). Add the words to `server/moderation/wordlists.js` via a PR. |
| Someone reports a copied project | — | Mentor sees the duplicate-check notice on the review queue / project page. Talk to the team first. |
| A season entry is wrong | Team entered the wrong track | While entries are open the team can withdraw and re-enter; after that an admin edits it in the database. |

**Rollback:** Railway/Netlify → Deployments → *Redeploy* the last good deploy. College server: `git checkout <last-good-commit> && docker compose --env-file .env.docker up -d --build`.

## 6. Backups & restore

- **Atlas (UAT):** M0 free tier has no automatic backups — run `mongodump --uri "<MONGO_URI>" --db nec_innovation_lab --gzip --archive=nec-$(date +%F).gz` weekly and keep the file somewhere safe (not in git). Paid tiers: turn on Cloud Backup.
- **College server:** `scripts/backup.sh` (daily via cron, keeps 14). Copy `backups/` off the server weekly.
- **Restore (college server):** `sh scripts/restore.sh backups/<file>.archive.gz` — it asks for `yes`, then replaces the data.
- **Never** run `npm run seed` against a database with real users — it wipes it.

## 7. Rotating secrets

| Secret | Where to make a new one | Then |
|---|---|---|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` | Set it, redeploy. Everyone is logged out once. |
| Atlas DB password | Atlas → Database Access → edit user | Update `MONGO_URI`, redeploy. |
| `GITHUB_TOKEN` | GitHub → Settings → Developer settings → Fine-grained tokens | Set, redeploy, revoke the old one. |
| AWS keys | IAM → user → Security credentials → new key | Set both, redeploy, deactivate then delete the old key. |
| `RESEND_API_KEY` | resend.com → API Keys | Set, redeploy, delete the old key. |
| `LOTUS_API_KEY` | Ask Saravonix | Set, redeploy. |

## 8. Handing over to the next batch

Before the senior maintainers graduate:

1. Add the new maintainers to the GitHub repo (Maintain role) and to `.github/CODEOWNERS` (PR).
2. Transfer or share access — **always to a college-owned account, not a personal one**: GitHub org, Railway project, Netlify site, Atlas project, AWS IAM (the S3 bucket), Resend team, domain DNS (college IT).
3. Walk the new maintainers through this runbook and one full deploy + rollback.
4. Remove the leaving students' access everywhere above, then rotate every secret in section 7.
5. Update the names at the top of this file.

## 9. Moving from free tiers to the college server

See `docs/DEPLOY.md` → *College server (Docker)*. Order: take an Atlas `mongodump` → bring up Docker → `mongorestore` into it → point DNS at the server → watch for a day → switch off Railway/Netlify.
