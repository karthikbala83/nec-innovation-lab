# NEC Innovation Lab — Student guide

**Site:** https://nec-innovation-lab.saravonix.com · Works on your phone.

Your project gets a launch page on the college's portal: your story, demo, team and code — checked by the college, approved by your mentor. Share one link (and a QR on your resume).

---

## 1. Sign in (1 minute)
1. Open the site → **Login** → **Sign in with Google**.
2. Choose your **@nandhaengg.org** college Google account (personal Gmail won't work).
3. First time? Fill in department, batch and roll number. Add your **GitHub username** — it links your commits to you.

A short tour starts after your first sign-in. Replay it any time with the **?** button.

## 2. Launch your project (about 10 minutes)
Tap **＋ Launch** and go through the six steps — it saves at every step.

**Shortcut:** have a public GitHub repo? Paste it in the purple **Fill from GitHub** box on the first step. The portal reads your repo's description and README and fills in the title, tagline, story, demo video and screenshots. Then just check each step. (A good README = a 3-minute launch.)

| Step | What to have ready |
|---|---|
| Basics | Title, a one-line tagline (≤ 140 characters), department, stage |
| Story | The problem, your solution, impact so far (numbers beat adjectives) |
| Proof & media | **Demo video first:** YouTube (unlisted is fine) or Google Drive (*Share → General access: Anyone with the link*) — it plays at the top of your page. Then screenshots (hardware: photos of your build), live demo link, GitHub repo. Hardware projects don't need code. |
| Team | Add teammates by their **college email** (they must have signed in once), their roles, and choose your **faculty mentor** |
| Code | **Import from GitHub** — the portal reads your stack, who committed what, and warns you privately if a password/key was committed |
| Submit | Your mentor reviews it. Nothing is public until they approve |

## 3. Private GitHub repo? Create a read-only token
If your repo is public, skip this. If it is **private**, the portal needs a token that can only **read that one repository**. It is used once for the import and then discarded — never saved.

1. On GitHub (signed in as the repo owner) go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   (direct link: https://github.com/settings/personal-access-tokens/new).
2. **Token name:** `nec-innovation-lab` · **Expiration:** 7 days.
3. **Resource owner:** you — or your team's organisation if the repo belongs to one (an org admin may have to approve the token).
4. **Repository access:** *Only select repositories* → pick your project repo.
5. **Permissions → Repository permissions → Contents: Read-only.** (Metadata: Read-only is added automatically.) Leave everything else at *No access*.
6. **Generate token** → copy it (starts with `github_pat_`).
7. In the wizard's **Code** step tick **My repo is private**, paste the token, click **Import from GitHub**.
8. Afterwards you can delete the token on GitHub. For a later re-import, make a new one the same way.

⚠️ Never give a token **write** access, never paste it anywhere else, never commit it to your code.

## 4. After you're approved
- **Share** — on your project page: **WhatsApp** or **Copy feedback link**. Anyone can ♡ like it and send feedback, even without an account.
- **Inbox** — feedback and "can you build one for us?" requests arrive here. Reply on the portal; your phone number and email are never shown.
- **Lotus check** — once your repo is imported, tap **Take your Lotus check** on your project page: questions about *your own* code. A short viva with your mentor then earns the **✔ Verified** badge recruiters look for.
- **Updates** — post progress on your project page; recent updates raise your Lab Score.
- **Seasons** — enter your project into the semester Demo Day or a hackathon season.
- **Project expo / demo day** — on your project page tap **🖨 Expo poster & QR**: print an A4 stall poster or 4 QR table cards. Every scan is counted on your page.
- **Profile + QR** — **Profile** → *Download QR* for your resume.
- **Link previews** — when you paste your project link in WhatsApp or LinkedIn it shows your title, tagline and picture. Add a cover image or screenshots so it looks good.

## 5. Rules
- Be kind and specific in comments and feedback. Abusive, spammy or off-topic messages are blocked or held for review.
- Don't put phone numbers or emails in messages — the portal relays replies for you.
- Only real work you did. Your mentor sees a duplicate check against other college projects.

**Stuck?** Ask in the pilot WhatsApp group, or your mentor.
