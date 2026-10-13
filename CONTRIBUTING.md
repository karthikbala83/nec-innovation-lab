# Contributing to NEC Innovation Lab

This portal is maintained by students. Every change goes through a branch and a pull request — the same flow shown in `docs/git-merge-lab.html`.

## The flow

```bash
git switch main && git pull                 # start from the latest main
git switch -c feature/<short-name>          # one branch per change
# ...code...
git status                                  # check .env is NOT listed
git add . && git commit -m "Add backers count to project card"
git push -u origin feature/<short-name>
```

Then open a Pull Request on GitHub into `main`.

## Rules

| Rule | Why |
|---|---|
| Never commit to `main` directly | `main` is what runs on the college domain |
| Never commit `.env`, keys or passwords | They become public forever. If it happens, tell a maintainer and rotate the key |
| One feature per PR, small is better | Easier to review, fewer conflicts |
| At least 1 review from a maintainer before merge | `.github/CODEOWNERS` assigns reviewers |
| CI must pass | Server installs, client builds |
| Test locally before pushing (`npm run dev`) | Broken builds block everyone |
| Follow the structure: thin routes, controllers do the work, models own data rules | See `docs/STARTER.md` |

## Got a merge conflict?

1. `git pull` on your branch, or merge `main` into it: `git merge main`
2. Open each file Git lists, pick the right code, delete the `<<<<<<<`, `=======`, `>>>>>>>` lines
3. `git add <file>` then `git commit`
4. Stuck? `git merge --abort` and ask in the club group

## Picking work

Issues labelled **good first issue** are sized for first-year contributors. Comment on an issue before starting so two people don't build the same thing.
