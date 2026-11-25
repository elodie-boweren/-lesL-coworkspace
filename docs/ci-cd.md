# CI/CD — CoWork'Space

This document describes the continuous integration strategy and Git rules for the repository.

Target stack: React (Vite) + Fastify + PostgreSQL + Prisma · Jest / Supertest · GitHub Actions.

---

## 1. Goals

- Keep broken commits off `main` without review.
- Standardize the team flow: **branch → pull request → review → merge**.
- Run lint, tests, and build automatically on every PR.
- Keep `main` always deployable / demo-ready (presentation).

---

## 2. CI pipeline (GitHub Actions)

File: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

### Triggers

| Event | Branches | Effect |
|---|---|---|
| `pull_request` | targeting `main` | Runs CI (PR checks) |
| `push` | on `main` | Re-runs CI after merge |

### Planned jobs

Once the monorepo is in place (`apps/api`, `apps/web`):

| Job | Contents |
|---|---|
| `api` | `npm ci` → lint → Jest / Supertest |
| `web` | `npm ci` → lint → tests → Vite build |

Until the apps exist, the workflow ships a minimal `ci` job (checkout + structure check) so **green checks** can already be required on PRs.

### Failure rule

If a job fails, the PR cannot be merged (see §3). Fix on the branch and push again: CI re-runs.

---

## 3. Branch protection (`main`)

Team rule: **no direct pushes to `main`**. Everything goes through a PR.

Configure on GitHub:  
**Settings → Branches → Add branch ruleset** (or *Branch protection rule*) for `main`:

| Setting | Value | Why |
|---|---|---|
| Require a pull request before merging | **Yes** | Blocks direct pushes |
| Required approvals | **1** | Another teammate reviews |
| Require status checks to pass | **Yes** | Green CI before merge |
| Required status checks | job(s) from the `CI` workflow (e.g. `ci`, later `api` / `web`) | Checks must be green |
| Require conversation resolution | Optional | Close review threads before merge |
| Do not allow bypassing the above settings | **Yes** (if possible) | Admins follow the same rule |

### Who reviews whom

Each person reviews someone else’s PRs (rotation is fine). Authors do not self-approve.

### Bypass

None in normal use. For an emergency (demo hotfix), document it in the PR and restore the rule immediately after.

---

## 4. Contribution workflow

```text
main (protected)
  └── feature/… or fix/… or chore/…
        └── Pull Request → 1 review + green CI → merge
```

1. Start from up-to-date `main`: `git pull origin main`
2. Create a short named branch: `feat/admin-spaces`, `fix/conflict-detection`, `docs/ci-cd`…
3. Commit regularly with clear messages
4. Open a PR to `main` (description + ticket link if needed)
5. Wait for **green CI** + **1 approval**
6. Merge (squash or merge commit — pick one team convention and stick to it)

### Branch naming (suggestion)

| Prefix | Usage |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Tooling, CI, deps |
| `docs/` | `/docs` or README |

---

## 5. One-time activation checklist

Do this once on the GitHub repository (owner / admin):

- [ ] Push `.github/workflows/ci.yml` and this file via a PR
- [ ] Confirm the workflow appears under **Actions** and goes green
- [ ] Enable branch protection on `main` (§3)
- [ ] Select the exact status check(s) in the ruleset (GitHub lists them after at least one successful run)
- [ ] Smoke-test: direct push to `main` → **rejected**; PR without review / red CI → **merge blocked**

Useful command (after `gh auth login`) to list rulesets:

```bash
gh api repos/elodie-boweren/-lesL-coworkspace/rulesets
```

---

## 6. Planned follow-ups (outside immediate MVP)

- npm / pnpm cache in Actions to speed up jobs
- Docker / Compose job (Postgres + Mailpit) for integration tests
- Notifications (Slack / Google Chat) on pipeline failure
- Preview environment (optional)

These are not required to close the “branch protection” ticket.
