# CoWork'Space

Coworking space booking platform — monorepo.

| Part | Path | Stack |
|---|---|---|
| API | [`apps/api`](apps/api) | Node.js · Fastify · Jest |
| Web | `apps/web` *(coming soon)* | React · Vite |
| Infra (local) | [`docker-compose.yml`](docker-compose.yml) | PostgreSQL 16 · Mailpit |

---

## Prerequisites

- **Node.js 26** (version pinned in [`.nvmrc`](.nvmrc)) — with nvm: `nvm use`
- **npm** (bundled with Node)
- **Docker** + **Docker Compose** (Docker Desktop on Windows/macOS)
- **Git**

---

## 1. First-time setup

```bash
# Clone the repository
git clone https://github.com/elodie-boweren/-lesL-coworkspace.git
cd -lesL-coworkspace

# Use the right Node version
nvm use

# Install root tooling (husky + commitlint git hooks)
npm install

# Install API dependencies
cd apps/api
npm install
cd ../..

# Create your local environment file
cp .env.example .env
```

Then open `.env` and set a password:

- `POSTGRES_PASSWORD` — any local password
- `DATABASE_URL` — replace `CHANGE_ME` with **the same** password

> `.env` is git-ignored. Never commit it.

---

## 2. Start the local services (Docker)

Docker runs the **database** and the **mail catcher** only. The API runs on your machine (see step 3).

```bash
# Start in the background
docker compose up -d

# Check status (db should become "healthy")
docker compose ps
```

| Service | Container | URL / port | Purpose |
|---|---|---|---|
| PostgreSQL | `cowork-db` | `localhost:5433` | Application database |
| Mailpit (SMTP) | `cowork-mailpit` | `localhost:1025` | Catches every email sent by the API |
| Mailpit (UI) | `cowork-mailpit` | <http://localhost:8025> | Read the caught emails |

> Postgres is exposed on **5433** (not 5432) to avoid clashing with a local Postgres install. Change `POSTGRES_PORT` in `.env` if needed.

Useful commands:

```bash
docker compose logs -f db        # follow database logs
docker compose stop              # stop containers (data is kept)
docker compose down              # remove containers (data is kept in the volume)
docker compose down -v           # remove containers AND wipe the database volume
```

---

## 3. Run the API in development

```bash
cd apps/api
npm run dev
```

- Loads variables from the root `.env` file.
- Restarts automatically on file changes (`node --watch`).
- Listens on <http://localhost:3000> (or `PORT` from `.env`).

Check that it is up:

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":1.23}
```

To run without watch mode (closer to production): `npm start`. In that case, environment variables must be provided by the shell.

---

## 4. Tests

```bash
cd apps/api
npm test
```

- Runner: **Jest**
- Test files: `apps/api/tests/**/*.test.js`
- HTTP routes are tested with Fastify's `app.inject()` — no need to start the server or Docker for the current tests.

---

## 5. Lint & formatting

All commands run from `apps/api`:

| Command | What it does |
|---|---|
| `npm run lint` | Runs ESLint on the whole API |
| `npm run format:check` | Checks formatting with Prettier (no changes) |
| `npm run format` | Formats every file with Prettier |

Prettier rules: single quotes, semicolons, trailing commas, 100-char lines (see [`apps/api/.prettierrc`](apps/api/.prettierrc)).

**Before opening a PR**, make sure these pass:

```bash
npm run lint && npm run format:check && npm test
```

---

## 6. Commits & contribution workflow

Commit messages must follow **[Conventional Commits](https://www.conventionalcommits.org/)** — a git hook (husky + commitlint) rejects the commit otherwise.

```text
feat(api): add booking endpoint
fix(api): handle overlapping reservations
chore: update dependencies
docs: add README
```

Workflow: branch → pull request → 1 review + green CI → merge.
See [`docs/ci-cd.md`](docs/ci-cd.md) for branch naming, protection rules and CI details.

---

## Project structure

```text
.
├── apps/
│   └── api/
│       ├── src/
│       │   ├── app.js          # Fastify app factory (used by server + tests)
│       │   ├── server.js       # Entry point: starts the HTTP server
│       │   └── routes/         # Route plugins (health, ...)
│       └── tests/              # Jest tests
├── docs/                       # Project documentation
├── .github/                    # CI workflow + PR template
├── .husky/                     # Git hooks
├── docker-compose.yml          # Postgres + Mailpit
└── .env.example                # Environment template
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `cowork-db` exits immediately | `POSTGRES_PASSWORD` is empty in `.env` |
| Port 5433 / 1025 / 8025 already in use | Change the port in `.env` (Postgres) or stop the conflicting process |
| Commit rejected by commitlint | Rewrite the message as `type(scope): description` |
| `npm run dev` can't find `.env` | Make sure `.env` exists at the **repository root**, not in `apps/api` |
| Wrong Node version errors | Run `nvm use` (Node 26 required) |