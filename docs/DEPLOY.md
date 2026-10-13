# Deploying NEC Innovation Lab

| Part | Service | From |
|---|---|---|
| Frontend (React) | **Netlify** | `client/` — config in `netlify.toml` |
| API (Express) | **Railway** | `server/` — config in `server/railway.json` |
| Database | **MongoDB Atlas** | database `nec_innovation_lab` |
| Media (images) | **AWS S3** | `s3://nec-innovation-lab/students-projects/` |

Order matters: **S3 → Atlas → Railway → Netlify → back to Railway** (CORS needs the Netlify URL).

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
- **Better (recommended for production):** keep the bucket fully private, create a **CloudFront** distribution with Origin Access Control on the bucket, and set `S3_PUBLIC_BASE_URL=https://<dxxxx>.cloudfront.net` on Railway. Faster in India and no public bucket.

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
Create an access key (type "Application running outside AWS"). Keep the key ID + secret for Railway. Note the bucket's **region** (Bucket → Properties), e.g. `ap-south-1` (Mumbai).

---

## 2. MongoDB Atlas

1. **Database Access** → a user with *readWrite* on `nec_innovation_lab` only (not Atlas admin). Use a long random password.
2. **Network Access** → Railway's outbound IPs change, so add `0.0.0.0/0` (allow from anywhere). The strong password is what protects it. (Railway Pro offers static egress IPs if the college wants to lock this down.)
3. **Connect → Drivers** → copy the `mongodb+srv://…` string. The database name does **not** need to be in it: we set `MONGO_DB_NAME=nec_innovation_lab`.

UAT has been seeded (demo users + 4 projects). **Never run `npm run seed` against production once real students sign up — it wipes the collections.**

---

## 3. Railway (API)

1. railway.com → **New Project → Deploy from GitHub repo** → `karthikbala83/nec-innovation-lab`.
2. Service **Settings**:
   - **Root Directory:** `server`
   - **Watch paths:** `server/**` (so client-only commits don't redeploy the API)
   - Builder/start/health check come from `server/railway.json` (`node server.js`, health check `/api/health`).
3. **Variables** (Service → Variables → Raw editor):
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://<user>:<password>@nandha-cluster.u5al8ih.mongodb.net/?appName=nandha-cluster
   MONGO_DB_NAME=nec_innovation_lab
   JWT_SECRET=<64+ random characters — see below>
   JWT_EXPIRES_IN=1d
   CLIENT_URL=https://<your-site>.netlify.app
   CLIENT_URL_PATTERN=^https://[a-z0-9-]+--<your-site>\.netlify\.app$
   ALLOWED_EMAIL_DOMAIN=nandhaengg.org
   GITHUB_TOKEN=<fine-grained token, public repos read-only>
   GITHUB_CACHE_MINUTES=30
   JOBS_ENABLED=true
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=<from step 1c>
   AWS_SECRET_ACCESS_KEY=<from step 1c>
   S3_BUCKET=nec-innovation-lab
   S3_PREFIX=students-projects/
   S3_PUBLIC_BASE_URL=
   UPLOAD_MAX_MB=5
   ```
   Do **not** set `PORT` — Railway provides it.
   Generate the JWT secret locally:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
4. **Settings → Networking → Generate Domain** → e.g. `https://nec-innovation-lab-api.up.railway.app`.
5. Check: open `https://<api-domain>/api/health` → `{"ok":true,"db":"nec_innovation_lab",…}`.

GitHub token: github.com → Settings → Developer settings → Fine-grained tokens → *Public repositories (read-only)*, no extra permissions. Without it, imports are limited to ~1 per hour.

---

## 4. Netlify (frontend)

1. app.netlify.com → **Add new site → Import an existing project → GitHub** → same repo.
2. Build settings are read from `netlify.toml` (base `client`, build `npm ci && npm run build`, publish `dist`, SPA redirect, security headers). Leave the form as detected.
3. **Site configuration → Environment variables:**
   ```
   VITE_API_URL=https://<api-domain>.up.railway.app/api
   VITE_COLLEGE_DOMAIN=nandhaengg.org
   ```
4. Deploy. Note the site URL (rename it under *Site configuration → Change site name*, e.g. `nec-innovation-lab.netlify.app`).
5. **Back on Railway**, set `CLIENT_URL` (and `CLIENT_URL_PATTERN`) to that exact Netlify URL → Railway redeploys. Add the same URL to the S3 CORS list (step 1a).

`VITE_*` values are baked in at build time — after changing them, trigger *Deploys → Trigger deploy → Clear cache and deploy*.

---

## 5. Smoke test after deploy

1. `https://<site>.netlify.app` → feed shows 3 projects; open one, refresh the page (SPA redirect works).
2. Log in as the seeded admin → **Admin → Lab Score & moderation → Run daily checks now** → "1/1 live URLs up".
3. Log in as a seeded student → My projects → Edit → *Proof & media* → **Upload thumbnail** → image appears; its URL starts with your S3 / CloudFront base.
4. Sign up with a `@gmail.com` address → refused; with `@nandhaengg.org` → works.
5. `/leaderboards`, `/u/arun-k` (QR) load without login.

---

## 6. Before real students use it

- [ ] **Change every seeded password** (admin123 / faculty123 / student123 are public in this repo) — or delete the demo users and promote real faculty via *Admin → People*.
- [ ] Password reset emails are **not sent yet** (the link is only logged on the server). Add an email provider (SES / Resend) before go-live, or reset passwords via admin.
- [ ] Custom domain: Netlify → Domain management → add `innovation.nandha.ac.in`; college IT adds the CNAME. Then add it to `CLIENT_URL` and the S3 CORS list.
- [ ] Atlas: enable backups (M10+) or schedule `mongodump`.
- [ ] Rotate the AWS key and GitHub token if they are ever pasted anywhere public.

## Local development against Atlas
Some routers refuse the DNS lookups `mongodb+srv://` needs (`querySrv ECONNREFUSED`). Add to `server/.env`:
```
DNS_SERVERS=1.1.1.1,8.8.8.8
```
