# Operation System (OMS) – Inspection Record Management Module

Cloud-based Operations Management System module for recording, prioritizing, and reviewing
structural inspections (piers, wharves, bridges). Built for my MSIT capstone.

## Architecture

```
Browser (web UI) ──► web gateway :3000 ──► auth-service :4001 ──► PostgreSQL auth_db
                                     └──► inspection-service :4002 ──► PostgreSQL project_db
                                                                     └─► outbox_events ──► (Azure Service Bus)
```

| Folder | What it is |
|---|---|
| `web/` | Static web UI + API gateway (Express + http-proxy-middleware) |
| `auth-service/` | Login, bcrypt password check, issues JWTs |
| `inspection-service/` | Validation, repair priority, review workflow, PostgreSQL repository, outbox events |
| `perf/` | Demo data seeding and autocannon load tests |
| `deploy/` | Database init script and Azure deployment guide |

## Run locally with Docker

```bash
cp .env.example .env
docker compose up --build
docker compose exec auth-service node scripts/seed.js     # demo users (local only)
# open http://localhost:3000
```

## Run locally without Docker (Node 20 + PostgreSQL 16)

```bash
export JWT_SECRET=local-dev-secret
export DATABASE_URL=postgres://oms_dev:localdevpassword@localhost:5432/project_db
(cd inspection-service && npm ci && npm run migrate && npm start)
(cd auth-service && npm ci && DATABASE_URL=postgres://oms_dev:localdevpassword@localhost:5432/auth_db npm run migrate && \
   DATABASE_URL=postgres://oms_dev:localdevpassword@localhost:5432/auth_db npm run seed && \
   DATABASE_URL=postgres://oms_dev:localdevpassword@localhost:5432/auth_db npm start)
(cd web && npm ci && npm start)
```

## Tests

```bash
cd inspection-service && npm test && npm run test:integration   # integration needs DATABASE_URL
cd auth-service && npm test
cd perf && npm install && npm run load-test                      # system must be running
```

## Branching model

- `main` – stable, released code only (every release is tagged)
- `develop` – integration branch for finished features
- `feature/*` – one branch per feature, merged into `develop`
- `release/*` – final checks before merging into `main`
- `hotfix/*` – urgent fixes branched from `main`
