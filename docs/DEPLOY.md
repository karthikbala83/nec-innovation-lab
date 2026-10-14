# Deploying NEC Innovation Lab

| Part | Service | From |
|---|---|---|
| Frontend (React) | **Netlify** | `client/` — config in `netlify.toml` |
| API (Express) | **Render** | `server/` — blueprint in `render.yaml` |
| Database | **MongoDB Atlas** | database `nec_innovation_lab` |
| Media (images) | **AWS S3** | `s3://nec-innovation-lab/students-projects/` |

Order matters: **S3 → Atlas → Render → Netlify → back to Render** (CORS needs the site URL).

---

## 1. AWS S3 (one-time)

The browser uploads images **directly to S3** with a 5-minute presigned POST from the API. The API never handles the file. S3 itself enforces: exact key under `students-projects/<projectId>/`, image type, ≤ 5 MB.

### 1a. Bucket CORS (Bucket → Permissions → CORS)
```json
[
  {
    "AllowedOrigins": ["https://<your-site>.netlify.app", "http://localhost:5173"],
    "AllowedMethods": ["POST", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```
Add the college domain (e.g. `https://innovation.nandha.ac.in`) here later.

### 1b. Public read for the folder only
Images on launch pages must be readable by anyone. Choose **one**:

- **Simple:** Bucket → Permissions → Block public access → untick only *"Block public access … granted through new public bucket policies"* and *"…any public bucket policies"*. Then add this bucket policy (only `students-projects/` becomes public; the rest of the bucket stays private):
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "PublicReadProjectMedia",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nec-innovation-lab/students-projects/*"
    }]
  }
  ```
- **Better (recommended for production):** keep the bucket fully private, create a **CloudFront** distribution with Origin Access Control on the bucket, and set `S3_PUBLIC_BASE_URL=https://<dxxxx>.cloudfront.net` on Render. Faster in India and no public bucket.

### 1c. IAM user for the API (IAM → Users → Create user, no console access)
Attach this inline policy — it can only **write** into the project folder, nothing else:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::nec-innovation-lab/students-projects/*"
  }]
}
```
Create an access key (type "Application running outside AWS"). Keep the key ID + secret for Render. Note the bucket's **region** (Bucket → Properties), e.g. `ap-south-1` (Mumbai).

---

## 2. MongoDB Atlas

1. **Database Access** → a user with *readWrite* on `nec_innovation_lab` only (not Atlas admin). Use a long random password.
2. **Network Access** → add Render's outbound IPs (Render → service → *Outbound IP addresses*), or `0.0.0.0/0` (allow from anywhere) with a strong DB password.
3. **Connect → Drivers** → copy the `mongodb+srv://…` string. The database name does **not** need to be in it: we set `MONGO_DB_NAME=nec_innovation_lab`.

UAT has been seeded (demo users + 4 projects). **Never run `npm run seed` against production once real students sign up — it wipes the collections.**

---

## 3. Render (API) — live: https://nec-innovation-lab.onrender.com

1. render.com → **New → Web Service** → connect `karthikbala83/nec-innovation-lab` (or **New → Blueprint** and pick `render.yaml`).
2. Settings: **Root Directory** `server` · **Build** `npm ci --omit=dev` · **Start** `node server.js` · **Health Check Path** `/api/health` · **Auto-Deploy: On** for branch `main`.
3. **Environment** (Render → Environment):
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://<user>:<password>@nandha-cluster.u5al8ih.mongodb.net/?appName=nandha-cluster
   MONGO_DB_NAME=nec_innovation_lab
   JWT_SECRET=<64+ random characters>
   JWT_EXPIRES_IN=1d
   CLIENT_URL=https://nec-innovation-lab.saravonix.com,https://nec-innovation-lab.netlify.app
   PUBLIC_SITE_URL=https://nec-innovation-lab.saravonix.com
   ALLOWED_EMAIL_DOMAIN=nandhaengg.org
   GOOGLE_CLIENT_ID=<same value as Netlify's VITE_GOOGLE_CLIENT_ID>
   GITHUB_TOKEN=<fine-grained token, public repositories read-only>
   RESEND_API_KEY=<send-only key>
   MAIL_FROM=NEC Innovation Lab <noreply@saravonix.com>
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=<from step 1c>
   AWS_SECRET_ACCESS_KEY=<from step 1c>
   S3_BUCKET=nec-innovation-lab
   S3_PREFIX=students-projects/
   LOTUS_MOCK=true            # until Saravonix issues LOTUS_API_URL + LOTUS_API_KEY
   ```
   Always write `https://` in `CLIENT_URL` (the API now adds it if missing, but be explicit). Do **not** set `PORT` — Render provides it.
4. Check: `https://nec-innovation-lab.onrender.com/api/health` → `{"ok":true,"db":"nec_innovation_lab"}`.

**Render free tier sleeps after ~15 minutes idle**: the first request then takes ~50 s, and the in-app daily checks only run while it is awake. For the pilot either upgrade to the *Starter* instance (always on) or add a free uptime pinger hitting `/api/health` every 10 minutes. Atlas Network Access must allow Render's outbound IPs (Render → service → *Outbound IP addresses*), or `0.0.0.0/0` with a strong DB password.

## 4. Netlify (frontend)

1. app.netlify.com → **Add new site → Import an existing project → GitHub** → same repo.
2. Build settings are read from `netlify.toml` (base `client`, build `npm ci && npm run build`, publish `dist`, SPA redirect, security headers). Leave the form as detected.
3. **Site configuration → Environment variables:**
   ```
   VITE_API_URL=https://nec-innovation-lab.onrender.com/api
   VITE_GOOGLE_CLIENT_ID=<Google OAuth web client id>
   VITE_COLLEGE_DOMAIN=nandhaengg.org
   ```
4. Deploy. Note the site URL (rename it under *Site configuration → Change site name*, e.g. `nec-innovation-lab.netlify.app`).
5. **Back on Render**, put the site URL(s) in `CLIENT_URL` (with `https://`) → Render redeploys. Add the same URL to the S3 CORS list (step 1a).

`VITE_*` values are baked in at build time — after changing them, trigger *Deploys → Trigger deploy → Clear cache and deploy*.

---

## 4b. Google sign-in (college Google Workspace)

1. Google Cloud console → APIs & Services → Credentials → **OAuth client ID (Web application)**.
2. **Authorised JavaScript origins:** `https://nec-innovation-lab.saravonix.com`, `https://nec-innovation-lab.netlify.app`, `http://localhost:5173`. (No redirect URIs needed — the button uses a popup.)
3. OAuth consent screen: *Internal* (only the college Workspace) is simplest.
4. Put the client ID in Netlify (`VITE_GOOGLE_CLIENT_ID`, then *Clear cache and deploy*) **and** Render (`GOOGLE_CLIENT_ID`).
5. The API only accepts verified emails on `ALLOWED_EMAIL_DOMAIN` whose Google Workspace domain matches — personal Gmail accounts are refused. First sign-in creates a student account and asks for department, batch and roll number. Admins promote faculty in *Admin → People*.

## 5. Smoke test after deploy

1. `https://<site>.netlify.app` → feed shows 3 projects; open one, refresh the page (SPA redirect works).
2. Recruiter flow: Admin → People → *Invite a recruiter* → open the set-password link in a private window → Talent → Request intro → back as admin: Admin → Intro requests → Forward.
3. Likes & feedback: open a project in a private window (no login) → ♡ Like → *Give feedback* → enter name/email/mobile → code arrives by email → send. Log in as the owner → Inbox → reply; the visitor gets an email with a private link to reply back. Admin → Feedback moderation shows held messages.
4. Log in as the admin → **Admin → Lab Score & moderation → Run daily checks now** → "1/1 live URLs up".
3. Log in as a seeded student → My projects → Edit → *Proof & media* → **Upload thumbnail** → image appears; its URL starts with your S3 / CloudFront base.
4. Sign up with a `@gmail.com` address → refused; with `@nandhaengg.org` → works.
5. `/leaderboards`, `/u/arun-k` (QR) load without login.

---

## 6. Before real students use it

- [ ] Demo accounts: the seed never puts passwords in the repo (it uses `SEED_PASSWORD` or a random one written to the git-ignored `server/.seed-credentials.txt`). For real users, start from a clean database or remove the `demo-…` accounts.
- [ ] Password reset emails are **not sent yet** (the link is only logged on the server). Add an email provider (SES / Resend) before go-live, or reset passwords via admin.
- [ ] Custom domain: Netlify → Domain management → add `innovation.nandha.ac.in`; college IT adds the CNAME. Then add it to `CLIENT_URL` and the S3 CORS list.
- [ ] Atlas: enable backups (M10+) or schedule `mongodump`.
- [ ] Rotate the AWS key and GitHub token if they are ever pasted anywhere public.

## 7. Custom domain (e.g. `innovation.nandha.ac.in`)

Ask college IT for two DNS records:

| Record | Name | Points to |
|---|---|---|
| CNAME | `innovation` | `<your-site>.netlify.app` (Netlify → Domain management → *Add a domain* shows the exact target) |
| CNAME | `api.innovation` | the target Render shows under Service → Settings → *Custom Domains* |

Then:
1. Netlify adds the domain and issues HTTPS automatically. Set it as the *primary* domain.
2. Render: add `api.innovation.nandha.ac.in` as a custom domain (HTTPS is automatic).
3. Render variables: `CLIENT_URL=https://innovation.nandha.ac.in` (keep the netlify.app URL too, comma-separated, during the switch).
4. Netlify variables: `VITE_API_URL=https://api.innovation.nandha.ac.in/api` → *Clear cache and deploy*.
5. S3 CORS: add `https://innovation.nandha.ac.in`. Resend: verify the domain so `MAIL_FROM=…@innovation.nandha.ac.in` works.
6. Profile QR codes use the address the page is opened on, so they switch to the college domain on their own. Ask students to download their QR again once the domain is live.

## 8. College server (Docker)

Everything in one box: `caddy` (HTTPS) → `web` (nginx + React) → `api` → `mongo`. The site and the API share one domain (`/api`), so there is no CORS to configure.

Server: Ubuntu 22.04+, 2 vCPU, 4 GB RAM, 20 GB disk; Docker Engine + compose plugin; ports 80 and 443 open; DNS `A` record for the domain → the server's public IP.

```bash
git clone https://github.com/karthikbala83/nec-innovation-lab.git /opt/nec-innovation-lab
cd /opt/nec-innovation-lab
cp .env.docker.example .env.docker      # fill in SITE_DOMAIN, JWT_SECRET, keys…
docker compose --env-file .env.docker up -d --build
docker compose ps                        # all services "healthy"
```

Moving data from Atlas: `mongodump --uri "<atlas uri>" --db nec_innovation_lab --gzip --archive=atlas.gz`, copy `atlas.gz` into `backups/`, then
`docker compose exec -T mongo mongorestore --gzip --archive=/backups/atlas.gz`.

Updates: `git pull && docker compose --env-file .env.docker up -d --build`. Backups: `scripts/backup.sh` from cron (see `docs/RUNBOOK.md`).
MongoDB is not published to the host network; reach it with `docker compose exec mongo mongosh`.

## Local development against Atlas
Some routers refuse the DNS lookups `mongodb+srv://` needs (`querySrv ECONNREFUSED`). Add to `server/.env`:
```
DNS_SERVERS=1.1.1.1,8.8.8.8
```
