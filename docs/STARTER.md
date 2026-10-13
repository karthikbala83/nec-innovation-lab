# MERN Deploy Starter 🚀

A complete, deployable MERN application with **your own authentication** (no Firebase/Supabase), proper project structure, real MongoDB queries beyond `find()`, and a **live admin dashboard**.

Built as a teaching template by **Saravonix Technologies** — reuse it for every future project.

## What you get

| Feature | Where to look |
|---|---|
| Signup / Login with bcrypt + JWT | `server/controllers/authController.js` |
| Forgot / Reset password (hashed, expiring token) | same file + `models/User.js` |
| Protected routes (frontend guard + backend middleware) | `client/src/App.jsx`, `server/middleware/auth.js` |
| Schemas with validation, indexes, nested JSON, arrays | `server/models/` |
| Medium queries: `$lookup` joins, `$group`, `$unwind`, `$facet`, nested-field filters | `server/controllers/adminController.js`, `noteController.js` |
| Live admin dashboard — who's online right now | `client/src/pages/Admin.jsx` + `models/Session.js` |

## Project structure (follow this in your own projects)

```
server/
  server.js          <- wiring only, keep small
  config/db.js       <- one DB connection
  models/            <- schemas = your "table creation"
  middleware/        <- auth check, activity heartbeat
  controllers/       <- business logic
  routes/            <- URL -> controller mapping
  utils/seed.js      <- demo data
client/
  src/api/axios.js   <- one API instance, token auto-attached
  src/context/       <- auth state for the whole app
  src/pages/         <- one file per screen
```

Rule of thumb: **routes stay thin, controllers do the work, models own the data rules.**

## Run locally

```bash
# 1. Backend
cd server
cp .env.example .env        # fill MONGO_URI (Atlas) and JWT_SECRET
npm install
npm run seed                # demo users: admin@demo.com/admin123, arun@demo.com/student123
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Show it to the world in 60 seconds (ngrok)

```bash
ngrok http 5000             # your API is now public
ngrok http 5173             # or expose the frontend
```
Great for demos — dies when your laptop sleeps. For real hosting:

## Deploy (all free tiers)

**1. MongoDB Atlas** — create free M0 cluster → Database Access: add user → Network Access: allow `0.0.0.0/0` → copy connection string.

**2. Render (API)** — New Web Service → connect this GitHub repo → Root Directory `server` → Build `npm install` → Start `npm start` → add env vars `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your Vercel URL), `NODE_ENV=production`.
> Free tier sleeps after 15 min idle; first request takes ~50s to wake.

**3. Vercel (frontend)** — Import repo → Root Directory `client` → add env var `VITE_API_URL=https://<your-render-app>.onrender.com/api` → Deploy.
> React Router fix: add `client/vercel.json` with a rewrite of all routes to `/` (already included).

**4. Update CORS** — set `CLIENT_URL` on Render to your Vercel URL and redeploy.

## Push this to your GitHub

```bash
git init
git add .
git commit -m "MERN deploy starter with own auth + admin dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/mern-deploy-starter.git
git push -u origin main
```

## Things to try next (homework)

1. Add pagination buttons to the Notes page (the API already supports `?page=`).
2. Add a `$lookup` query: which tag do high-priority notes use most?
3. Replace 10-second polling in Admin with WebSockets (socket.io).
4. Add email sending for forgot-password (nodemailer + Gmail app password).
5. Add refresh tokens so sessions last beyond 1 day safely.

---
*Saravonix Technologies Pvt. Ltd. — Built Right. Held Secure.*
