# Workflow to-do list

Gaps in the process described in [`workflow.md`](./workflow.md). Fix one at a time, in this order (cheapest and highest value first). Tick the box and note the PR when done.

## 1. [x] Lint reports 24 problems that are not in the app code (done on branch `docs-workflow`: `.agents/**` added to the ESLint ignores; `.agents/` and `skills-lock.json` added to `.gitignore`)
- **Problem:** `npm run lint` shows 24 problems (23 errors), but every one is in the untracked `.agents/` folder (`.agents/skills/security-audit/*.cjs`). Excluding it gives zero problems, so the app code is clean, but the noise makes "lint clean" impossible to read.
- **Fix:** add `".agents/**"` to `globalIgnores([...])` in `eslint.config.mjs` (and decide whether `.agents/` and `skills-lock.json` belong in `.gitignore` or in the repo).
- **Done when:** `npm run lint` exits 0 on a fresh checkout.

## 2. [x] No automatic tests on pull requests (done in PR #17: `.github/workflows/ci.yml`; Playwright runs only when app code changed; verified green on the PR itself)
- **Problem:** there is no `.github/workflows/`. Unit + Playwright tests only run when someone runs them by hand, so a PR can be merged untested.
- **Fix:** a GitHub Action that runs `tsc`, lint, unit and Playwright on every PR against a throwaway Neon branch (e.g. `neondatabase/create-branch-action`, deleted when the job ends). Needs the Neon API key and project id as GitHub secrets, and Mailpit as a service container.
- **Done when:** a PR shows green or red checks without anyone running tests locally.

## 3. [x] Vercel previews use the production environment (done in PR #18: Preview has its own Neon branch, secrets, mail catcher and Blob store; verified on a real preview deploy)
- **Problem:** a pushed branch builds a preview with production DB, JWT secret, Gmail and Blob settings, so clicking through a preview touches real data and real email.
- **Fix:** in Vercel, scope the production env vars to Production only and give Preview its own values (a Neon preview branch, a different `JWT_SECRET`, SMTP sink or Mailpit-like service, no Blob token). Document which vars Preview needs.
- **Done when:** a preview deploy cannot read or write production data.

## 4. [ ] Protect `main` and require checks
- **Problem:** nothing technical stops a direct push to `main` or a merge with failing checks (the rule is only in `AGENTS.md`). Neon production is also unprotected (plan limit).
- **Fix:** GitHub branch protection on `main`: require a pull request and the CI checks from item 2; no force pushes. Check whether Neon branch protection is available on the current plan.
- **Done when:** a direct push to `main` is rejected.

## 5. [ ] Docs drift after merges
- **Problem:** docs fell behind (e.g. the changelog said "not yet merged" after merging; PR #16 had to fix it).
- **Fix:** add `.github/pull_request_template.md` with a checklist: CHANGELOG entry, `CLAUDE.md` updated, tests listed, deploy notes, backlog item moved. Set the changelog header to the PR number when the PR is opened, not the branch name.
- **Done when:** every new PR shows the checklist.

## 6. [ ] Creating and deleting the test environment is manual and error-prone
- **Problem:** about ten manual steps (create branch, copy connection string, quote or unquote it, allow-list the host, seed users, start Mailpit and the server, clean up). Mistakes this session: quotes in the wrong env file, an unquoted `&` when sourcing, Docker not running.
- **Fix:** a script (`scripts/preview-up.sh` and `preview-down.sh`) that creates the Neon branch, writes both env files with the right quoting, starts Mailpit and the dev server, seeds the demo users, and tears everything down including the branch.
- **Done when:** one command starts a ready preview and one command removes it.

## 7. [ ] Real email delivery is never verified
- **Problem:** local tests use Mailpit, so Gmail delivery, spam placement and the sender setup are unchecked. Invite emails go out via a Gmail SMTP account.
- **Fix:** after any email change, send one real message to your own address and note where it lands. Longer term: a proper sender domain with SPF/DKIM (or a transactional provider), and a Gmail daily sending limit check.
- **Done when:** the invite and verification emails land in an inbox (not spam) and this check is a line in the PR checklist.

## 8. [ ] Test data contains real student data
- **Problem:** a Neon branch is a full copy of production, so every test branch holds real student PII until it is deleted, and the Neon MCP cannot create schema-only branches or set an expiry.
- **Fix:** look for a schema-only or anonymised branch option (Neon CLI/API, or a branch with a scrub script right after creation); until then keep the "delete the branch when done" step.
- **Done when:** test branches never contain real names, emails or phone numbers.
