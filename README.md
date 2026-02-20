# FibCalc — Distributed Fibonacci via Docker Microservices

A production-grade reference project that teaches the full journey from local Docker
development to automated cloud deployment on AWS. The application itself is a
distributed Fibonacci calculator — intentionally simple so the infrastructure and
tooling take centre stage.

---

## Table of Contents

- [Architecture](#architecture)
- [Technologies](#technologies)
- [Skills Taught](#skills-taught)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [CI/CD Pipeline](#cicd-pipeline)
- [AWS Infrastructure](#aws-infrastructure)
- [Environment Variables](#environment-variables)

---

## Architecture

```
Browser
   │
   ▼
┌──────────────────────────────────────────────────┐
│  Nginx (reverse proxy)  :3050 (dev) / :80 (prod) │
│  • routes /      → React client                  │
│  • routes /api/* → Node API                      │
│  • routes /ws    → React HMR websocket           │
└──────────┬───────────────────┬───────────────────┘
           │                   │
           ▼                   ▼
   ┌───────────────┐   ┌───────────────┐
   │  React Client │   │   Node API    │
   │  (CRA / nginx)│   │  Express :5000│
   └───────────────┘   └──────┬────────┘
                              │  writes index + publishes "insert" event
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
             ┌────────────┐      ┌──────────────┐
             │ PostgreSQL │      │    Redis      │
             │ (persist   │      │ (cache +      │
             │  indexes)  │      │  pub/sub)     │
             └────────────┘      └──────┬───────┘
                                        │ subscribes to "insert"
                                        ▼
                                 ┌──────────────┐
                                 │    Worker    │
                                 │  computes    │
                                 │  fib(n) and  │
                                 │  writes back │
                                 └──────────────┘
```

**Request flow:**
1. User submits an index → Nginx proxies to the API
2. API saves the index to **PostgreSQL** and pushes an `insert` event to **Redis pub/sub**
3. **Worker** picks up the event, computes `fib(n)`, and stores the result in Redis
4. React polls every 1.5 s — new pills and results appear without a page reload

---

## Technologies

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | **React 18** + React Router v6 | SPA with client-side routing |
| HTTP client | **Axios** | API calls from the browser |
| API server | **Node.js** + **Express 5** | REST endpoints |
| Background job | **Node.js Worker** | Async Fibonacci computation |
| Cache / Pub-Sub | **Redis** (v5 client) | Fast read cache + event bus |
| Database | **PostgreSQL** (pg v8) | Persistent index storage |
| Reverse proxy | **Nginx** | Routing, WS upgrade, security headers |
| Containerisation | **Docker** + **Docker Compose** | Service isolation and orchestration |
| Image registry | **Docker Hub** | Central image store |
| CI/CD | **GitHub Actions** | Automated build → test → scan → deploy |
| Security scanning | **Trivy** | Container image vulnerability scanning |
| Cloud platform | **AWS Elastic Beanstalk** | Managed multi-container deployment |
| Object storage | **AWS S3** | Deployment bundle storage |
| Managed Redis | **AWS ElastiCache** | Production Redis with TLS |
| Managed Postgres | **AWS RDS** | Production Postgres with SSL |
| Hot reload | **Nodemon** | Auto-restart on file change (dev) |

---

## Skills Taught

### 1. Docker Fundamentals
- Writing `Dockerfile` and `Dockerfile.dev` for every service
- Layer caching — copying `package.json` before source so `npm install` is only
  re-run when dependencies change
- **Anonymous volume trick** — mounting `/app/node_modules` as an unnamed volume
  so the host bind-mount does not overwrite the container's installed modules
- Multi-stage builds — `deps → test → builder → prod` stages in the client image
  so the final image is a tiny nginx container with only the compiled static files

### 2. Docker Compose
- Defining a full multi-service stack in a single file
- `depends_on` — express service startup ordering
- Bind mounts + named volumes for live code reload in development
- Per-environment compose files (`docker-compose-dev.yml` vs `docker-compose.yml`)
- Injecting environment variables into containers

### 3. Nginx as a Reverse Proxy
- Upstream blocks to route traffic to named Docker services
- Path-based routing (`/` → client, `/api/*` → API) with URL rewriting
- **WebSocket proxy** — upgrading the `/ws` connection for React HMR in dev
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `X-XSS-Protection`, `Referrer-Policy`, `Strict-Transport-Security`

### 4. Microservice Communication Patterns
- **Synchronous REST** — browser talks to the API over HTTP
- **Asynchronous pub/sub** — API publishes to Redis; worker subscribes and
  processes jobs independently, decoupling compute from the request cycle
- Services discover each other by **Docker DNS name** (no hardcoded IPs)

### 5. Environment-Aware Configuration

> **Key lesson:** never hardcode infrastructure settings.
> Use `NODE_ENV` to branch between dev and production behaviour.

- Redis **TLS** is enabled only when `NODE_ENV !== "development"` — local Redis
  has no certificate; ElastiCache does
- Postgres **SSL** is enabled only in production — local Postgres is plain TCP;
  RDS uses SSL
- All secrets flow in as environment variables; nothing is baked into images

### 6. GitHub Actions CI/CD Pipeline

The workflow (`.github/workflows/.githubactions.yml`) implements a
production-quality pipeline with five stages:

```
push to main
     │
     ▼
1. changes        ← path-filter: detect which services actually changed
     │
     ├──────────────────────────────────────────┐
     ▼            ▼            ▼                ▼
2a. build_client  2b. build_server  2c. build_worker  2d. build_nginx
    (parallel fan-out — only rebuilds services with code changes)
    • runs tests (client)
    • builds & pushes to Docker Hub (SHA tag + latest)
    • scans image with Trivy for CRITICAL/HIGH CVEs
    • retagging: if unchanged, just retags latest with the new SHA
     │
     ▼
3. deploy_eb      ← gates on all 4 build jobs
    • captures current EB version for rollback
    • zips docker-compose.yml + .env + .platform/ hooks
    • uploads bundle to S3, registers EB version, triggers deployment
    • waits for environment to reach Ready state
     │
     ▼
4. smoke_test
    • resolves live endpoint URL from EB
    • probes /api/values/all and /api/values/current (5 retries, 15 s apart)
    • writes a markdown summary table to the GitHub job summary
     │
     └── (on failure) ──▶ 5. rollback
                              • redeploys the previous EB version label
                              • waits for rollback to complete
```

**Key CI/CD concepts demonstrated:**
- **Change detection** with `dorny/paths-filter` — skip unchanged services to
  save build minutes and reduce blast radius
- **Registry layer caching** — `cache-from/cache-to` with a `buildcache` tag
  so Docker layer cache survives across GitHub Actions runners
- **Semantic image tagging** — both `:<git-sha>` (immutable, traceable) and
  `:latest` (convenience) pushed on every build
- **Concurrency groups** — `cancel-in-progress: true` prevents redundant
  in-flight deployments when commits are pushed rapidly
- **GitHub Environments** — the `production` environment gate enables
  required-reviewer approval before deploy runs
- **Automatic rollback** — smoke test failure triggers re-deploy of the
  previously captured version label, with zero manual intervention

### 7. AWS Elastic Beanstalk Multi-Container Deployment
- EB pulls pre-built images from Docker Hub (no build on the instance)
- `.platform/hooks/predeploy/01_inject_env.sh` — a **predeploy platform hook**
  that writes EB environment properties into `.env` so `docker-compose`
  variable substitution picks them up at container start
- `docker-compose.yml` is the deployment descriptor; EB reads it directly

### 8. Security Practices
- **No secrets in images** — all credentials are environment variables
- **Least-privilege** — containers only receive the env vars they need
- **Vulnerability scanning** — Trivy runs on every pushed image
- **TLS everywhere in production** — Redis over TLS (ElastiCache), Postgres
  over SSL (RDS), HTTPS terminated at the ALB
- **HTTP security headers** on every nginx response
- `.gitignore` excludes `keys.**` and `node_modules`

### 9. Developer Experience
- Hot reload for all three backend services via **Nodemon** — save a file,
  the container restarts automatically
- React **HMR** (Hot Module Replacement) over WebSocket proxied through nginx
- `WDS_SOCKET_PORT=0` — tells the CRA dev server to use the page's own port
  (3050) for the HMR websocket so it works behind the nginx proxy

---

## Project Structure

```
.
├── client/                  React frontend
│   ├── nginx/default.conf   nginx config for the production static-file server
│   ├── Dockerfile           Multi-stage: deps → test → builder → prod (nginx)
│   ├── Dockerfile.dev       Development image (CRA dev server)
│   └── src/
│       ├── App.js           Router + navbar layout
│       ├── Fib.js           Calculator — polling, form, results
│       └── OtherPage.js     About page
│
├── server/                  Node.js Express API
│   ├── index.js             Routes: GET /values/all, GET /values/current, POST /values
│   ├── keys.js              Env-var bindings
│   ├── Dockerfile           Production image
│   └── Dockerfile.dev       Dev image (nodemon)
│
├── worker/                  Background compute service
│   ├── index.js             Redis subscriber — computes fib(n) on "insert" events
│   ├── keys.js              Env-var bindings
│   ├── Dockerfile           Production image
│   └── Dockerfile.dev       Dev image (nodemon)
│
├── nginx/                   Reverse proxy
│   ├── default.conf         Upstream routing + WS + security headers
│   ├── Dockerfile           Production image
│   └── Dockerfile.dev       Dev image
│
├── .github/workflows/
│   └── .githubactions.yml   Full CI/CD pipeline
│
├── .platform/hooks/predeploy/
│   └── 01_inject_env.sh     EB predeploy hook — injects secrets into .env
│
├── docker-compose.yml       Production descriptor (image references)
└── docker-compose-dev.yml   Local dev stack (build from source + volumes)
```

---

## Local Development

**Prerequisites:** Docker Desktop

```bash
# Clone the repo
git clone https://github.com/relhe/complex-docker.git
cd complex-docker

# Start all services (builds images on first run)
docker compose -f docker-compose-dev.yml up --build
```

Open **http://localhost:3050** — the app is live.

| Service | Address inside Docker network |
|---|---|
| React (via nginx) | `http://localhost:3050` |
| API (direct) | `http://localhost:3050/api/...` |
| Postgres | `postgres:5432` |
| Redis | `redis:6379` |

**Hot reload is on** — editing any file under `client/src/`, `server/`, or
`worker/` is reflected instantly without restarting compose.

---

## CI/CD Pipeline

Every push to `main` triggers the GitHub Actions workflow automatically.

**Required GitHub secrets:**

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `AWS_ACCESS_KEY_ID` | IAM key with EB + S3 permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_REGION` | e.g. `us-east-1` |
| `EB_APPLICATION_NAME` | Elastic Beanstalk application name |
| `EB_ENVIRONMENT_NAME` | Elastic Beanstalk environment name |
| `S3_BUCKET` | S3 bucket for deployment bundles |

---

## AWS Infrastructure

```
Internet
    │
    ▼
 ALB (HTTPS termination)
    │
    ▼
 Elastic Beanstalk EC2 instance
    │
    ├─ nginx container       (port 80)
    ├─ react-client container
    ├─ node-server container  (port 5000)
    └─ node-worker container
         │                 │
         ▼                 ▼
    ElastiCache        RDS PostgreSQL
    Redis (TLS)        (SSL)
```

> **Note:** ElastiCache and RDS are **not** managed by Elastic Beanstalk. They are
> provisioned separately and their connection details are supplied to EB as
> environment properties, which the predeploy hook injects into the container stack.

---

## Environment Variables

### API (`server/`)

| Variable | Dev default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Controls TLS/SSL — must be `production` in prod |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `PGUSER` | `postgres` | Postgres user |
| `PGHOST` | `postgres` | Postgres hostname |
| `PGPASSWORD` | `postgres_password` | Postgres password |
| `PGDATABASE` | `postgres` | Postgres database name |
| `PGPORT` | `5432` | Postgres port |

### Worker (`worker/`)

| Variable | Dev default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Controls TLS — must be `production` in prod |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
