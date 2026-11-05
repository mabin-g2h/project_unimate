# Change workflow

How a change goes from idea to production in UniMate. Short version: **plan, branch, throwaway test environment, build, test, you confirm, commit, push, PR, merge, clean up.** Gaps in this process are tracked separately in [`workflow-todo.md`](./workflow-todo.md).

Related: `AGENTS.md` (how to work in the repo, "Done means"), `docs/testing-plan.md` (harness and manual-testing recipe), `docs/CHANGELOG.md` (what changed and why).

## 1. Understand first (no edits yet)
- Read the request or screenshot, then the code involved.
- Check `docs/CHANGELOG.md` and `docs/backlog.md` before designing, so past decisions are not undone.
- For bugs, look at production **read-only** (logs, row counts) to find the real cause before guessing.
- Agree a plan and settle open questions (placement, wording, scope) before building.

## 2. Start clean
- `git checkout main && git pull`, then a new feature branch. Never work on `main`.
- One change per branch and per PR. Small PRs are easier to review and to revert.

## 3. Create a throwaway test environment
- Create a Neon branch off `production` (e.g. `preview/<topic>`). It is a copy of production **including real student data**, so it is deleted at the end.
- Point a gitignored env file at it. Never use `.env.local` (that is production).
  - `.env.test` is for the automated tests: connection string **unquoted** (the harness parser does not strip quotes), and its host in `TEST_DB_ALLOWED_HOSTS`.
  - `.env.preview` is for clicking around: connection string **single-quoted** (it contains `&`), `APP_URL=http://localhost:3200`.
- Docker Desktop must be running. `npm run test:mail` starts Mailpit, so email goes to http://localhost:8025 instead of real inboxes.
- Seed fake users (e.g. `viewer@manual.test`) rather than using real student data. Recipe: `docs/testing-plan.md`.
- Only one `next dev` can run per checkout. Stop the preview server before running `npm run test:*`.

## 4. Build and test in layers
- While building: `npx tsc --noEmit` plus the targeted tests for what you touched.
- Bug fixes: write the failing test first, then the fix.
- Look at it yourself in the browser at desktop and phone width, and try the failure case too (e.g. force a failed save).
- Prove isolation: the change shows up on the test branch and production has nothing from the session (read-only `SELECT`).

## 5. You confirm, then the full suite
- The change is previewed and approved by you first.
- Then the full run locally: `npm run test:unit`, `npx playwright test` (about 12 minutes), `npx tsc --noEmit`, `npm run lint`. CI repeats the same checks on every pull request (`.github/workflows/ci.yml`; Playwright only when app code changed, against its own throwaway Neon branch), and the PR cannot be merged until they are green.
- Report results honestly, including anything skipped (e.g. the `ALLOW_MAIL_OUTAGE=1` test) and anything not verifiable locally (real Gmail delivery).

## 6. Docs and commit
- Add a `docs/CHANGELOG.md` entry: what, why (with evidence), tests, deploy notes.
- Update `CLAUDE.md` if routes, components, flows, schema or env vars changed (`/update-unimate`).
- Commit only files that belong to the change (not `.env*`, `.claude/`, `.agents/`). Imperative subject, no `Co-Authored-By` trailers.

## 7. Push, PR, merge
- Push the branch, then open the PR against `main` (`/new-pr`): why, what, tests, deploy notes. Pushing a new branch is done by the user (`! git push -u origin <branch>`).
- Wait for the CI checks (`Checks (tsc, lint, unit)`, `Playwright (api, e2e, security)`) to be green. `main` is protected, so a failing or missing check blocks the merge.
- Squash-merge (the only enabled method; GitHub deletes the remote branch automatically). Then `git checkout main && git pull`, and delete the local branch and any worktree.
- After the deploy: check the Vercel build is green and smoke-test the change. For anything that sends email, send one real message to yourself.
- Schema changes: idempotent migration appended to `db/schema.sql`, applied to the test branch first and to production only with explicit approval.

## 8. Clean up (every time)
- Delete the Neon test branch.
- Stop the dev server and Mailpit (`docker stop unimate-mailpit`), delete `.env.preview`.
- Leave `.env.test` pointing nowhere stale: the next test run starts by creating a new branch.

## Rules that always apply
- Never test against production data or env.
- Ask before anything outward-facing or hard to undo: push, merge, deleting branches, sending real email.
- Never print or write the `origin` remote URL (it may hold a token).
- Never commit to `main`. It is protected by the GitHub ruleset `Protect main`: a pull request is required, the two CI checks must pass, force pushes and deletion are blocked, and nobody (including the owner) can bypass it. To change the rule in an emergency, edit the ruleset in the repo settings and restore it afterwards.
