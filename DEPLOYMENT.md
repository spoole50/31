# Deployment Guide

## Quick Deploy to Render.com (Recommended)

### Backend Deployment
1. Create account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new "Web Service"
4. Settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn wsgi:app`
   - **Environment**: Python 3
   - **Root Directory**: `backend`

### Frontend Deployment  
1. Create a new "Static Site" on Render
2. Settings:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `build`
   - **Root Directory**: `frontend`
3. Add environment variable:
   - `REACT_APP_API_URL`: Your backend service URL

### Environment Variables
Add these to your backend service:
- `FRONTEND_URL`: Your frontend URL (for CORS)

## Alternative: Railway.app

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Deploy backend: 
   ```bash
   cd backend
   railway up
   ```
4. Deploy frontend:
   ```bash
   cd frontend  
   npm run build
   railway up --service frontend
   ```

## Alternative: Netlify + Heroku

### Frontend (Netlify)
1. Build: `npm run build` in frontend folder
2. Deploy build folder to Netlify
3. Set environment variable: `REACT_APP_API_URL`

### Backend (Heroku)
1. Install Heroku CLI
2. In backend folder:
   ```bash
   heroku create your-app-name
   git subtree push --prefix backend heroku main
   ```

## Local Development
1. Backend: `cd backend && python main.py`
2. Frontend: `cd frontend && npm start`

## Production Considerations
- [ ] Set up proper environment variables
- [ ] Configure CORS for production domains
- [ ] Consider adding rate limiting
- [ ] Set up monitoring/logging
- [ ] Add database for persistent game state (optional)
- [ ] Configure CDN for card images (optional)
