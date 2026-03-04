# Deployment Guide

## Live URLs

| | URL |
|---|---|
| Frontend | https://31.spoole.fyi |
| Backend API | https://xspmedirzf.us-east-1.awsapprunner.com |

## Architecture

| Layer | Service | Notes |
|---|---|---|
| Frontend | AWS Amplify | Auto-deploys from GitHub on every push |
| Backend | AWS App Runner | Runs the Flask/Gunicorn container from ECR |
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
REACT_APP_API_URL=http://localhost:8000 npm start
```

Or create `frontend/.env.development` so you don't have to set it every time:
```
REACT_APP_API_URL=http://localhost:8000
```

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
python main.py

# Frontend (separate terminal)
cd frontend
npm install
npm start
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

# Build, tag, and push
docker build -t card-game-31-backend ./backend
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
   | `REACT_APP_API_URL` | `https://xxxxxxxx.us-east-1.awsapprunner.com` |

5. Click **Save and deploy** (~2 min)

### Step 7 — Smoke test

```bash
curl https://xxxxxxxx.us-east-1.awsapprunner.com/api/health
# {"status": "healthy", ...}
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
| App Runner | 0.25 vCPU / 0.5 GB | ~$5–12 (scales to zero when idle) |
| Amplify Hosting | Free tier | $0 (first 1,000 build mins/mo free) |
| ECR | First 500 MB free | ~$0 |

---

## Production Checklist

- [ ] `REACT_APP_API_URL` set correctly in Amplify env vars
- [ ] CORS working — test from browser console (no blocked requests)
- [ ] Backend health endpoint returns 200
- [ ] Consider replacing in-memory game state with Redis/DynamoDB for persistence across redeploys
- [ ] Add rate limiting to API routes
- [ ] Set up CloudWatch alerts on App Runner for error spikes
