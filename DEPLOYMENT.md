# Deployment Guide

## Live URLs

| | URL |
|---|---|
| Frontend | https://31.spoole.fyi |
| Backend API | https://xspmedirzf.us-east-1.awsapprunner.com |

## Architecture

| Layer | Service | Notes |
|---|---|---|
| Frontend | AWS Amplify | Auto-deploys from GitHub `main` on every push |
| Backend | AWS App Runner | Runs the FastAPI + Socket.IO ASGI container from ECR |
| Container registry | Amazon ECR | Stores Docker images |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+ (`.nvmrc` pins 24 — with [fnm](https://github.com/Schniz/fnm) or
  nvm installed, `cd` into the repo and it selects the right version)

Docker is **not** required for development or deployment. See
[Container images](#container-images) below.

### Run it

```bash
# One-time setup
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
npm install

# Both servers, one command
npm run dev
```

That starts uvicorn on `:8000` with `--reload` and Vite on `:3000`. Vite proxies
`/api` and `/socket.io` to the backend, so no env var is needed locally, and
`http://localhost:3000` is allowed by CORS unconditionally.

To run them separately:

```bash
npm run dev:backend     # uvicorn main:app --reload --port 8000
npm run dev:frontend    # vite on :3000
```

**Verify the backend:**
```bash
curl http://localhost:8000/api/health
# {"status":"healthy","version":"2.0.0","games":0,"tables":0,"connected_players":0,"redis":false}
```

### Running the tests

The same checks CI runs, locally:

```bash
# Backend API tests (in-process, no running server needed)
.venv/bin/pip install -r backend/requirements-dev.txt
cd backend && python -m pytest

# Frontend: build the bundle, then execute it in jsdom to catch runtime faults
npm --workspace frontend run test

# Socket.IO path (needs the backend running — impersonation guard, hand hiding)
pip install "python-socketio[asyncio_client]" aiohttp
python backend/scripts/socket_smoke.py
```

The pytest suite asserts the security guarantees this project depends on: the
two unauthenticated game endpoints stay deleted (404) and CORS is an allowlist,
not `*`. `socket_smoke.py` covers what a TestClient can't — that a socket cannot
act as a player it doesn't own.

---

## AWS Deployment

### Prerequisites

1. [AWS account](https://aws.amazon.com)
2. AWS CLI: `brew install awscli`
3. Docker Desktop running
4. Repo pushed to GitHub

### Step 1 — Create an IAM user for deployments

1. **AWS Console → IAM → Users → Create user**
   - Username: `card-game-deploy`
   - Attach policies: `AmazonEC2ContainerRegistryFullAccess` + `AWSAppRunnerFullAccess`
2. Open the user → **Security credentials → Create access key → CLI**
3. Copy the Access Key ID and Secret (only shown once)

### Step 2 — Configure AWS CLI profile

```bash
aws configure --profile card-game
# Enter: Access Key ID, Secret Access Key, region (us-east-1), output (json)

# Verify it works
aws sts get-caller-identity --profile card-game

# Set as default for your session
export AWS_PROFILE=card-game
```

### Step 3 — Create an ECR repository

```bash
aws ecr create-repository --repository-name card-game-31-backend --region us-east-1
```

Note the `repositoryUri` from the output, e.g.:
```
123456789.dkr.ecr.us-east-1.amazonaws.com/card-game-31-backend
```

### Step 4 — Build and push the Docker image

<a id="container-images"></a>

App Runner runs **linux/amd64**. On an Apple Silicon Mac that means a cross-architecture
build, which is the one thing local container tooling makes awkward — Apple's native
`container` CLI is built around running native arm64 Linux VMs, so producing an amd64
artifact with it is fighting the tool. So the build runs in CI, where the runner is
already amd64 and nobody has to remember the `--platform` flag.

> **This is automated.** [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml)
> builds and pushes the image, then rolls out App Runner, on every push to `main`
> that touches `backend/**` (and via the Actions **Run workflow** button). It
> authenticates with OIDC — no AWS keys are stored in GitHub. Configure it once
> per [GitHub Actions setup](#github-actions-setup) below; after that you never
> build the backend locally. The manual path below is only a fallback.

<details>
<summary>Manual build (requires Docker or colima locally)</summary>

```bash
# Authenticate Docker to ECR (replace with your account ID)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# --platform is mandatory on Apple Silicon; without it App Runner
# silently fails to start an arm64 image.
docker build --platform linux/amd64 -t card-game-31-backend ./backend
docker tag card-game-31-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/card-game-31-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/card-game-31-backend:latest
```

</details>

### Step 5 — Create the App Runner service (Backend)

1. **AWS Console → App Runner → Create service**
2. Source: Container registry → Amazon ECR → select `card-game-31-backend:latest`
3. Deployment trigger: **Manual** — the deploy workflow calls `StartDeployment`
   explicitly so CI can report success/failure and wait for the rollout. (You
   *can* leave it Automatic instead and clear the `APPRUNNER_SERVICE_ARN`
   variable; App Runner then pulls `:latest` on its own, but the workflow won't
   see the rollout status.)
4. Service settings:
   - Port: `8000`
   - CPU: 0.25 vCPU / Memory: 0.5 GB
5. **Environment variables:**

   | Key | Value |
   |---|---|
   | `ALLOWED_ORIGINS` | `https://31.spoole.fyi` |

   > **Required.** CORS is an allowlist, not `*`. Without this the deployed
   > frontend is blocked by the browser and both REST and Socket.IO fail.
   > Comma-separate multiple origins (e.g. to include an Amplify preview URL).
   > `http://localhost:3000` is always permitted and need not be listed.

6. Click **Create & deploy** (~3 min)
7. Copy the service URL: `https://xxxxxxxx.us-east-1.awsapprunner.com`

### Step 6 — Deploy the frontend on Amplify

1. **AWS Console → AWS Amplify → Create new app**
2. Connect GitHub → select your repo and `main` branch
3. Amplify detects `amplify.yml` automatically — confirm build settings:
   - Build command: `npm run build`
   - Output dir: `frontend/build`
4. **Advanced settings → Environment variables:**

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://xxxxxxxx.us-east-1.awsapprunner.com` |

   > ⚠️ Vite inlines env vars at **build time**. After setting or changing `VITE_API_URL`
   > you must trigger a new Amplify build (push a commit or click **Redeploy this version**).

5. **App settings → Rewrites and redirects → Add rule:**

   | Source | Target | Type |
   |---|---|---|
   | `/<*>` | `/index.html` | `200 (Rewrite)` |

   > Without this, deep links return **HTTP 404**. Amplify still serves
   > `index.html` as its 404 body, so React boots and the app *appears* to work —
   > but every refresh mid-game, and every shared link, responds 404 to browsers,
   > caches and crawlers. This is console-only configuration; it is not captured
   > in `amplify.yml`, so it must be re-applied if the app is ever recreated.

6. Click **Save and deploy** (~2 min)

### Step 7 — Smoke test

```bash
curl https://xxxxxxxx.us-east-1.awsapprunner.com/api/health
# {"status":"healthy","version":"2.0.0","games":0,"tables":0,"connected_players":0,"redis":false}
```

Open your Amplify URL and start a local game to confirm end-to-end connectivity.

---

## GitHub Actions setup

Two workflows live in [`.github/workflows/`](.github/workflows/):

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | every PR + push to `main` | Backend pytest, frontend build + jsdom render check, Socket.IO impersonation smoke test. Touches no cloud. |
| `deploy-backend.yml` | push to `main` under `backend/**`, or manual | Builds the amd64 image, pushes to ECR, rolls out App Runner. |

CI needs no configuration. The deploy workflow needs a one-time IAM setup so it
can talk to AWS **without any stored keys** (GitHub OIDC).

### 1. Create the OIDC identity provider (once per AWS account)

If you have never wired GitHub to this account before:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

### 2. Create the deploy role

Trust policy — save as `trust.json`, replacing the repo if you forked it:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::289213110445:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:spoole50/31:*" }
    }
  }]
}
```

```bash
aws iam create-role --role-name card-game-deploy \
  --assume-role-policy-document file://trust.json

# ECR push + App Runner rollout. Scope tighter if you prefer.
aws iam attach-role-policy --role-name card-game-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
aws iam attach-role-policy --role-name card-game-deploy \
  --policy-arn arn:aws:iam::aws:policy/AWSAppRunnerFullAccess
```

The `sub` condition scopes the role to this repository, so only workflows in
`spoole50/31` can assume it.

### 3. Set repository variables

**GitHub → repo → Settings → Secrets and variables → Actions → Variables tab.**
These are *variables*, not secrets — none of them is sensitive:

| Variable | Value |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::289213110445:role/card-game-deploy` |
| `ECR_REPOSITORY` | `card-game-31-backend` |
| `APPRUNNER_SERVICE_ARN` | your service ARN (leave unset to skip the rollout step) |

Push a backend change to `main`, or hit **Actions → Deploy backend → Run
workflow**, and watch it build, push, and roll out.

---

## Ongoing Deployments

| What changed | What to do |
|---|---|
| Frontend (JS/CSS) | `git push` to `main` → Amplify rebuilds automatically |
| Backend (Python) | `git push` to `main` (any `backend/**` change) → `deploy-backend.yml` builds, pushes, and rolls out. No local Docker. |

---

## Cost Estimate

| Service | Tier | ~Monthly cost |
|---|---|---|
| App Runner | 0.25 vCPU / 0.5 GB | **~$2.50 idle floor** + compute during requests |
| Amplify Hosting | Free tier | $0 (first 1,000 build mins/mo free) |
| ECR | First 500 MB free | ~$0 |

> ⚠️ **App Runner does _not_ scale to zero.** Even with no traffic it keeps the
> instance's memory provisioned and bills for it at ~$0.007/GB-hr. At the minimum
> 0.5 GB that is `0.5 × 0.007 × 730 ≈ $2.55/month` regardless of usage — which is
> the standing charge you see. Active vCPU/memory is billed on top only while
> requests are being served.
>
> **To cut the idle cost to ~$0**, move the container to a platform that scales to
> true zero:
> - **Google Cloud Run** — same Docker image, `--min-instances=0`, `--max-instances=1`
>   (keeps the single-worker in-memory model), high concurrency. At this traffic it
>   stays inside the always-free tier → ~$0/month. Supports WebSockets (60-min cap).
> - **Fly.io** — `auto_stop_machines` + `min_machines_running=0`; a stopped machine
>   bills ~$0 for compute. Native WebSocket support.
>
> Frontend stays on Amplify (or Cloudflare Pages / GitHub Pages), all $0. See
> "Reducing cost" in the root README for the architectural option (client-side
> local play) that removes the backend from the critical path entirely.

---

## Production Checklist

- [ ] GitHub Actions variables set (`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`,
      `ECR_REPOSITORY`, `APPRUNNER_SERVICE_ARN`) — see
      [GitHub Actions setup](#github-actions-setup)
- [ ] CI green on the branch (pytest, frontend render check, socket smoke)
- [ ] `ALLOWED_ORIGINS` set on App Runner to the frontend origin — **required**;
      CORS is an allowlist, so the site is broken without it
- [ ] `VITE_API_URL` set in Amplify environment variables
- [ ] Amplify redeploy triggered after setting env var (Vite inlines at build time)
- [ ] Amplify rewrite rule `/<*>` → `/index.html` (200) added, or deep links 404
- [ ] Backend health endpoint returns `{"version":"2.0.0",...}`
- [ ] WebSocket connects — browser Network tab shows `101 Switching Protocols` on `/socket.io/`
- [ ] CORS working — no blocked requests in browser console
- [ ] Online game: create table, add AI, start game, play a full round

### Known gaps

- [ ] **No rate limiting on any route.** Table and game creation are unbounded,
      so a trivial loop can exhaust the 0.5 GB instance.
- [ ] **Invite codes are not access control.** Tables are created with
      `is_private: false`, so `GET /api/tables/public` lists them and they can be
      joined by ID without the code.
- [ ] **A page refresh during an online game drops the player.** `table` is not
      persisted to localStorage, and REST rejoin requires status `waiting`, so
      the 30 s disconnect grace period cannot save a refreshing player.
- [ ] Redis (`REDIS_URL`) for state persistence across redeploys — the store
      interface exists but no mutation is actually persisted yet.
- [ ] CloudWatch alerts on App Runner for error spikes
