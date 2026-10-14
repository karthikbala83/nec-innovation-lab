# Lotus API — contract the portal expects

**Status:** proposal from the portal side (14 Oct 2026), for Saravonix to confirm or amend.
The engine, prompts and scoring live at Saravonix. This repo only has the thin client
`server/services/lotusClient.js`; if the real API differs, only that file changes.

## Auth & limits
- `Authorization: Bearer <LOTUS_API_KEY>`, JSON in/out, HTTPS.
- Portal timeout 90 s per call, one retry on network errors / 5xx.
- `429` = quota used up (portal shows "quota reached"). The portal also counts its own usage (`LOTUS_MONTHLY_QUOTA`).

## 1. Create a question set
`POST {LOTUS_API_URL}/v1/question-sets`

```json
{
  "ref": "<portal set id>",
  "student": { "ref": "<opaque user id>", "githubUsername": "arun-k" },
  "project": { "ref": "<id>", "title": "…", "tagline": "…", "problem": "…", "solution": "…",
               "category": "software", "stack": ["React", "Express"], "liveUrl": "https://…" },
  "repo": {
    "owner": "nec-demo", "name": "campusbus-live", "sha": "<commit>",
    "tree": ["server/server.js", "client/src/App.jsx", "…"],
    "keyFiles": [{ "path": "README.md", "size": 1200, "content": "…" }],
    "memberFiles": [{ "path": "server/controllers/busController.js", "changes": 12 }]
  },
  "petals": 8,
  "levels": 3
}
```
- The repo is **public**; the engine reads file contents from GitHub at `repo.sha` itself (the portal sends paths, not the code).
- `tree` excludes dependencies, builds, lockfiles, binaries and files > 500 KB.
- `memberFiles` = files this student committed, most-changed first → weight questions toward them so teammates get different sets.
- No names, emails, phone or roll numbers are sent. `.env` files are never sent.

**Response 200**
```json
{
  "setId": "lot_8f2c…",
  "questions": [
    { "id": "q1", "petal": 2, "level": 1, "text": "…", "filePath": "server/server.js" }
  ]
}
```
- 24 questions = 8 petals × 3 levels (L1 Explain, L2 Modify, L3 Extend). Petals: 1 Problem & users · 2 Architecture · 3 Data model · 4 API & logic · 5 Frontend · 6 Deployment · 7 Security · 8 Scale & next steps.
- **`filePath` must be a path from `repo.tree`.** The portal drops any question citing a file that isn't in the tree, or with petal/level out of range (spec §7).

## 2. Score answers
`POST {LOTUS_API_URL}/v1/question-sets/{setId}/score`

```json
{ "answers": [ { "questionId": "q1", "answer": "…" } ] }
```
**Response 200**
```json
{ "scores": [ { "questionId": "q1", "score": 2, "feedback": "One line of feedback." } ] }
```
- `score` is an integer 0–3; `feedback` ≤ 500 characters. Missing or invalid scores are stored as 0.
- Answers are never public on the portal. Faculty can override any score and mark the viva.

## Open questions for Saravonix
1. Synchronous as above, or async (`202` + webhook / poll)? The portal already runs both calls in the background and polls, so either works.
2. Does the engine need anything else (e.g. `secretWarnings` count for the Security petal)?
3. Quota per month for NEC, and what `429` returns.

## Development
With no `LOTUS_API_URL` (or `LOTUS_MOCK=true`) the portal uses a **mock**: placeholder questions labelled `[MOCK]` that cite real paths, scored by answer length. It is not an engine and must never be shown as one in production (`NODE_ENV=production` never mocks unless `LOTUS_MOCK=true`).
