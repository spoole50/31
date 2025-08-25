# Render.com Deployment Configuration

## Backend Service (Web Service)

### Service Settings:
- **Name**: `card-game-31-backend` (or your preferred name)
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend`

### Build & Deploy Settings:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn wsgi:app`

### Environment Variables:
- `FRONTEND_URL` = (will be set after frontend is deployed)
- `PYTHON_VERSION` = `3.11.7` (optional, Render auto-detects)

---

## Frontend Service (Static Site)

### Service Settings:
- **Name**: `card-game-31-frontend` (or your preferred name)
- **Environment**: `Node`
- **Region**: Same as backend
- **Branch**: `main`
- **Root Directory**: `frontend`

### Build & Deploy Settings:
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `build`

### Environment Variables:
- `REACT_APP_API_URL` = `https://your-backend-service-url.onrender.com`

---

## Deployment Order:
1. Deploy Backend first
2. Copy the backend URL
3. Deploy Frontend with backend URL in environment variables
4. Add frontend URL to backend's FRONTEND_URL environment variable

## URLs After Deployment:
- Backend API: `https://card-game-31-backend.onrender.com`
- Frontend App: `https://card-game-31-frontend.onrender.com`
- Game URL: Use the frontend URL to play!
