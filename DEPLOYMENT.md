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
- Python 3.11+, Node.js 18+, Docker Desktop

### Run with Docker (recommended — matches production)

**Terminal 1 — Backend:**
```bash
docker compose up --build
```

**Terminal 2 — Frontend (hot-reload):**
```bash
cd frontend
npm run dev     # Vite dev server on :3000, proxies /api and /socket.io to :8000
```

No env var needed locally — Vite's dev server proxy handles routing to `localhost:8000` automatically.

**Verify backend is healthy:**
```bash
curl http://localhost:8000/api/health
```

### Run without Docker

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

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

```bash
# Authenticate Docker to ECR (replace with your account ID)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Build (linux/amd64 — App Runner runs on x86_64)
docker build --platform linux/amd64 -t card-game-31-backend ./backend
docker tag card-game-31-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/card-game-31-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/card-game-31-backend:latest
```

### Step 5 — Create the App Runner service (Backend)

1. **AWS Console → App Runner → Create service**
2. Source: Container registry → Amazon ECR → select `card-game-31-backend:latest`
3. Deployment trigger: **Automatic**
4. Service settings:
   - Port: `8000`
   - CPU: 0.25 vCPU / Memory: 0.5 GB
5. Click **Create & deploy** (~3 min)
6. Copy the service URL: `https://xxxxxxxx.us-east-1.awsapprunner.com`

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

5. Click **Save and deploy** (~2 min)

### Step 7 — Smoke test

```bash
curl https://xxxxxxxx.us-east-1.awsapprunner.com/api/health
# {"status":"healthy","version":"2.0.0","games":0,"tables":0,"connected_players":0,"redis":false}
```

Open your Amplify URL and start a local game to confirm end-to-end connectivity.

---

## Ongoing Deployments

| What changed | What to do |
|---|---|
| Frontend (JS/CSS) | `git push` → Amplify rebuilds automatically |
| Backend (Python) | Re-run the `docker build / tag / push` commands from Step 4 → App Runner redeploys automatically |

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

- [ ] `VITE_API_URL` set in Amplify environment variables
- [ ] Amplify redeploy triggered after setting env var (Vite inlines at build time)
- [ ] Backend health endpoint returns `{"version":"2.0.0",...}`
- [ ] WebSocket connects — browser Network tab shows `101 Switching Protocols` on `/socket.io/`
- [ ] CORS working — no blocked requests in browser console
- [ ] Online game: create table, add AI, start game, play a full round
- [ ] Consider adding Redis (`REDIS_URL` env var on App Runner) for state persistence across redeploys
- [ ] Add rate limiting to API routes
- [ ] Set up CloudWatch alerts on App Runner for error spikes
