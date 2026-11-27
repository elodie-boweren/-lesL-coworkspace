# Secrets scanning — Gitleaks

We use [Gitleaks](https://github.com/gitleaks/gitleaks) to block accidental commits of secrets (API keys, passwords, tokens, `.env` values, etc.).

## CI

Workflow: [`.github/workflows/gitleaks.yml`](../.github/workflows/gitleaks.yml)

Runs on every PR / push to `main` and `develop`. The job must stay green before merge (add `gitleaks` to the branch ruleset status checks when you enable protection).

Image (GHCR, pinned by digest):

```text
ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f
```

The same image content is published on Docker Hub as `zricethezav/gitleaks`.

## Local scan

Requires Docker. From the repo root:

```bash
IMG="ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"
docker pull "$IMG"

# Scan the working tree (read-only mount)
docker run --rm -v "$PWD:/path:ro" "$IMG" dir /path
```

Or via npm (root):

```bash
npm run secrets:scan
```

Exit code ≠ 0 means at least one secret-like finding — fix or remove it before opening a PR.

## Rules of the road

- Never commit real `.env` files (see `.gitignore`)
- Use `.env.example` with placeholders only (`CHANGE_ME`, etc.)
- Prefer GitHub Secrets / local env for real credentials
- If Gitleaks reports a false positive, document an allowlist in `.gitleaks.toml` (team review required)
