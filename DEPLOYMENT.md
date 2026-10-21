# Deployment Guide

## Live URLs

| | URL |
|---|---|
| Frontend | https://31.spoole.dev |
| Backend API | https://xspmedirzf.us-east-1.awsapprunner.com |

## Architecture

| Layer | Service | Notes |
|---|---|---|
| Frontend | AWS Amplify | Auto-deploys from GitHub `main` on every push |
| Backend | AWS App Runner | Runs the FastAPI + Socket.IO ASGI container from ECR |
| Container registry | Amazon ECR | Stores Docker images |

### App Runner status (checked October 2026)

AWS [closed App Runner to new customers](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)
on April 30, 2026. **Existing accounts, including this one, are unaffected**:
services keep running and new ones can still be created. AWS will keep patching
security and availability but adds no new features. The only practical risk is
recreating the backend in a *new* AWS account, where App Runner won't be offered.

AWS's suggested replacement is ECS Express Mode (Fargate + an Application Load
Balancer). For one 0.25 vCPU container the load balancer alone costs more than
this whole stack, so it is not worth moving to unless App Runner's support
changes.

Two App Runner limits shape how the backend runs:

- **No WebSockets.** App Runner's proxy doesn't pass the WebSocket upgrade, so
  Socket.IO stays on HTTP long-polling in production. The client starts on
  polling (`frontend/src/lib/socket.js`), so this works; it is just chattier
  than a real socket. Locally you do get WebSockets.
- **Max one instance.** Game state is in process memory, and long-polling sends
  every request separately. With two instances a player's requests would land
  on different processes with different state. Pin the service with a
  single-instance auto scaling configuration ([Step 5](#step-5--create-the-app-runner-service-backend)).

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
# {"status":"healthy","version":"2.0.0","games":0,"tables":0,"connected_players":0}
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

Then add a lifecycle policy so old images don't pile up (every backend push adds one):

```bash
aws ecr put-lifecycle-policy --repository-name card-game-31-backend --lifecycle-policy-text '{
  "rules": [
    {"rulePriority": 1, "description": "Never expire the image App Runner deploys",
     "selection": {"tagStatus": "tagged", "tagPatternList": ["latest"], "countType": "imageCountMoreThan", "countNumber": 1},
     "action": {"type": "expire"}},
    {"rulePriority": 2, "description": "Keep manually tagged backups (e.g. pre-oct-2026)",
     "selection": {"tagStatus": "tagged", "tagPatternList": ["pre-*"], "countType": "imageCountMoreThan", "countNumber": 5},
     "action": {"type": "expire"}},
    {"rulePriority": 3, "description": "Keep the 3 most recent commit-SHA images for rollback",
     "selection": {"tagStatus": "tagged", "tagPatternList": ["*"], "countType": "imageCountMoreThan", "countNumber": 3},
     "action": {"type": "expire"}},
    {"rulePriority": 4, "description": "Expire orphaned untagged images after 1 day",
     "selection": {"tagStatus": "untagged", "countType": "sinceImagePushed", "countUnit": "days", "countNumber": 1},
     "action": {"type": "expire"}}
  ]
}'
```

> The CI build pushes `:latest` as an OCI image **index**; the amd64 image and
> its build attestation are untagged children of it. Rule 4 does not touch
> them — ECR won't expire an image while an index still references it — so it
> only removes children orphaned when `:latest` moves. To keep a known-good
> image indefinitely, tag it `pre-<something>`.

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
   - Health check: HTTP, path `/api/health`
   - Auto scaling: a custom configuration with **min 1 / max 1** (see below)
5. **Environment variables:**

   | Key | Value |
   |---|---|
   | `ALLOWED_ORIGINS` | `https://31.spoole.dev` |
   | `LOG_LEVEL` | `INFO` (optional; `DEBUG` logs per-turn game events) |
   | `CREATE_RATE_LIMIT`, `MAX_LIVE_GAMES`, `MAX_LIVE_TABLES` | optional; defaults 10/min per IP, 200, 100 (see `backend/.env.example`) |

   > **Required.** CORS is an allowlist, not `*`. Without this the deployed
   > frontend is blocked by the browser and both REST and Socket.IO fail.
   > Comma-separate multiple origins (e.g. to include an Amplify preview URL).
   > `http://localhost:3000` is always permitted and need not be listed.

6. Click **Create & deploy** (~3 min)
7. Copy the service URL: `https://xxxxxxxx.us-east-1.awsapprunner.com`

**Pinning to one instance.** App Runner's default auto scaling configuration
allows up to 25 instances, which would split game state (see
[App Runner status](#app-runner-status-checked-october-2026)). Create a
single-instance configuration once and attach it:

```bash
cfg_arn=$(aws apprunner create-auto-scaling-configuration \
  --auto-scaling-configuration-name card-game-single \
  --min-size 1 --max-size 1 --max-concurrency 100 \
  --query AutoScalingConfiguration.AutoScalingConfigurationArn --output text)

aws apprunner update-service --service-arn "$APPRUNNER_SERVICE_ARN" \
  --auto-scaling-configuration-arn "$cfg_arn"
```

Check an existing service with
`aws apprunner describe-service --service-arn "$APPRUNNER_SERVICE_ARN" --query Service.AutoScalingConfigurationSummary`.

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

### Step 6b — Custom domain (`31.spoole.dev`)

The game is served at `31.spoole.dev`. `spoole.dev` is registered in Route 53
in the same account, so Amplify creates its own DNS records and certificate:

```bash
aws amplify create-domain-association --app-id <APP_ID> \
  --domain-name spoole.dev --sub-domain-settings prefix=31,branchName=main
# Poll until domainStatus is AVAILABLE (~15–30 min while the cert issues)
aws amplify get-domain-association --app-id <APP_ID> --domain-name spoole.dev \
  --query domainAssociation.domainStatus
```

The old `31.spoole.fyi` domain stays attached to the app and permanently
redirects to the new one. That redirect is a rewrite rule, and **it must come
before the SPA rule** — Amplify applies the first match:

| Source | Target | Type |
|---|---|---|
| `https://31.spoole.fyi` | `https://31.spoole.dev` | `301` |
| `/<*>` | `/index.html` | `404-200` |

> Domain sources must be the bare origin — Amplify appends the path itself.
> A source like `https://31.spoole.fyi/<*>` is silently ignored.

`ALLOWED_ORIGINS` on App Runner must include `https://31.spoole.dev` (Step 5).

### Step 7 — Smoke test

```bash
curl https://xxxxxxxx.us-east-1.awsapprunner.com/api/health
# {"status":"healthy","version":"2.0.0","games":0,"tables":0,"connected_players":0}
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
| ECR | $0.10/GB-month | ~$0 (lifecycle policy keeps the repo small) |
| Route 53 | Hosted zone per domain | $0.50 per domain (`spoole.dev`, `spoole.fyi`) |
| Domain registration | Annual | $17/yr `spoole.dev`, $8/yr `spoole.fyi` |

> ⚠️ **App Runner does _not_ scale to zero.** Even with no traffic it keeps the
> instance's memory provisioned and bills for it at ~$0.007/GB-hr. At the minimum
> 0.5 GB that is `0.5 × 0.007 × 730 ≈ $2.55/month` regardless of usage — which is
> the standing charge you see. Active vCPU/memory is billed on top only while
> requests are being served.
>
> This is still the cheapest way to run the backend on AWS. ECS Express Mode,
> AWS's recommended App Runner replacement, adds an Application Load Balancer
> (~$16/month on its own before Fargate and public IPv4 charges). See
> "Reducing cost" in the root README for the architectural option (client-side
> local play) that takes the backend off the critical path for single-player.

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
- [ ] `31.spoole.dev` domain association AVAILABLE, and `31.spoole.fyi` 301s to it
      (see [Step 6b](#step-6b--custom-domain-31spooledev))
- [ ] ECR lifecycle policy applied (see Step 3)
- [ ] App Runner auto scaling pinned to **max 1 instance** — in-memory state breaks otherwise
- [ ] App Runner health check path set to `/api/health`
- [ ] Backend health endpoint returns `{"version":"2.0.0",...}`
- [ ] Socket.IO connects — browser Network tab shows `/socket.io/?EIO=4&transport=polling`
      requests returning 200 (App Runner has no WebSockets, so no `101` upgrade in prod)
- [ ] CORS working — no blocked requests in browser console
- [ ] Online game: create table, add AI, start game, play a full round

### Known gaps

- [ ] A refresh *on your own turn* still skips that turn (the disconnect
      handler skips immediately so the table doesn't stall).
- [ ] State doesn't survive a redeploy — games and tables live in process
      memory only, so a backend deploy ends every game in progress.
- [ ] CloudWatch alerts on App Runner for error spikes
