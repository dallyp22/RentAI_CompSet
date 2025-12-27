# PropertyPilot Deployment Guide

## Quick Links

- **GitHub Repo**: https://github.com/dallyp22/RentAI_CompSet
- **Vercel**: https://vercel.com (Frontend)
- **Railway**: https://railway.app (Backend + Database)

---

## Deployment Architecture

```
User Browser
     ↓
Vercel (Frontend - React SPA)
     ↓
Railway (Backend - Express API)
     ↓
Railway PostgreSQL (Database)
     ↓
External APIs: Firecrawl, OpenAI
```

---

## Option 1: Vercel + Railway (Recommended)

### Step 1: Deploy Backend to Railway

1. **Go to Railway.app** and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `dallyp22/RentAI_CompSet`
5. Railway will detect the Node.js app

#### Configure Environment Variables:

Click **"Variables"** tab and add:

```
FIRECRAWL_API_KEY=fc-ebc3a25a074f4464b39470228e2a9ac8
OPENAI_API_KEY=sk-proj-vFtN_pR8UKzCv0Ttv...
NODE_ENV=production
PORT=5000
```

#### Add PostgreSQL Database:

1. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway auto-configures `DATABASE_URL`
3. Run migrations: Click **"Deploy"** → **"Settings"** → **"Deploy Trigger"**
   - Or manually: `npm run db:push` from Railway console

#### Get Backend URL:

1. Go to **"Settings"** → **"Domains"**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://your-app.up.railway.app`)
4. **Save this** - you'll need it for Vercel!

### Step 2: Deploy Frontend to Vercel

1. **Go to Vercel.com** and sign in
2. Click **"Add New"** → **"Project"**
3. Import `dallyp22/RentAI_CompSet` from GitHub
4. **Configuration:**
   - Framework Preset: **Other**
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`

#### Environment Variables:

Add in Vercel dashboard:

```
VITE_API_URL=https://your-app.up.railway.app
NODE_ENV=production
```

**Important:** Replace `https://your-app.up.railway.app` with your actual Railway backend URL!

5. Click **"Deploy"**
6. Wait 2-3 minutes for build to complete

#### Configure Custom Domain (Optional):

1. Go to **"Settings"** → **"Domains"**
2. Add your custom domain (e.g., `propertypilot.yourdomain.com`)
3. Update DNS records as instructed

---

## Option 2: Railway Only (Simpler, Single Service)

Deploy both frontend and backend to Railway as a monolith:

1. **New Project** on Railway from GitHub
2. Add environment variables (same as above, no VITE_API_URL needed)
3. Add PostgreSQL database
4. Deploy!

Railway will serve both the API and the static frontend from the same instance.

**Pros:** Simpler setup, one bill  
**Cons:** Less scalable, frontend not on Vercel's CDN

---

## Post-Deployment Configuration

### 1. Update CORS Settings (if using separate frontend/backend)

In `server/index.ts`, add:

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-vercel-app.vercel.app',
  credentials: true
}));
```

### 2. Update API Base URL in Frontend

If deploying separately, create `client/src/config.ts`:

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
```

Update `client/src/lib/queryClient.ts` to use it.

### 3. Database Migrations

Railway auto-runs on deploy. Manual if needed:

```bash
# From Railway console
npm run db:push
```

---

## Environment Variables Reference

### Required for All Deployments

| Variable | Where to Get It | Example |
|----------|----------------|---------|
| `FIRECRAWL_API_KEY` | https://firecrawl.dev → Dashboard → API Keys | `fc-abc123...` |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | `sk-proj-...` |

### Database (Railway Auto-Configures)

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Railway PostgreSQL plugin |

OR use Neon Database:
- Go to https://neon.tech
- Create database
- Copy connection string

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 5000 | Server port |
| `NODE_ENV` | development | Environment mode |

---

## Vercel-Specific Configuration

### vercel.json

Already included in repo:
- Rewrites API calls to backend
- Serves React SPA with fallback to index.html
- Configured output directory

### Build Settings

```bash
Build Command: npm run build
Output Directory: dist/public
Install Command: npm install
Node Version: 18.x
```

---

## Railway-Specific Configuration

### railway.json

Already included in repo:
- Nixpacks builder
- Auto-detects Node.js
- Runs `npm run build` then `npm start`
- Restart policy on failure

### Dockerfile (Optional - Not Currently Used)

Railway auto-detects. Can add Dockerfile for more control.

---

## Monitoring & Logs

### Vercel

1. Go to your project dashboard
2. Click **"Deployments"**
3. Click on latest deployment
4. View **"Build Logs"** and **"Function Logs"**

### Railway

1. Go to your service
2. Click **"Deployments"**
3. Click on active deployment
4. View **"Build Logs"** and **"Deploy Logs"**
5. Runtime logs appear in real-time

---

## Troubleshooting

### Build Fails on Vercel

**Error:** `Module not found`
- **Fix:** Check `package.json` has all dependencies
- Run `npm install` locally to verify

**Error:** `Build exceeded time limit`
- **Fix:** Optimize build, remove unused dependencies
- Consider Railway monolith deployment

### Backend Errors on Railway

**Error:** `DATABASE_URL not found`
- **Fix:** Add PostgreSQL plugin or set DATABASE_URL manually

**Error:** `Port already in use`
- **Fix:** Railway sets PORT automatically, don't hardcode

**Error:** `API key not configured`
- **Fix:** Add environment variables in Railway dashboard

### CORS Errors

If frontend can't reach backend:
1. Add CORS middleware (see above)
2. Set `FRONTEND_URL` env var in Railway
3. Verify Railway backend URL is correct in Vercel

---

## Performance Optimization

### Frontend (Vercel)

- Automatically gets CDN caching
- Enable compression in build
- Consider lazy loading for pages

### Backend (Railway)

- Use connection pooling (Drizzle default)
- Add Redis for caching (Railway plugin)
- Scale horizontally if needed

### Database

- Add indexes (see `shared/schema.ts` for candidates)
- Use read replicas for scaling
- Monitor query performance

---

## Cost Estimates

### MVP/Testing (Low Traffic)

- **Railway**: $5-10/month (includes PostgreSQL)
- **Vercel**: Free tier (100GB bandwidth)
- **Firecrawl**: ~$20-50/month (depends on usage)
- **OpenAI**: ~$10-30/month (GPT-4 + GPT-3.5)

**Total:** $35-100/month

### Production (1000 properties/month)

- **Railway**: $20-50/month (scaled)
- **Vercel**: $20/month (Pro plan)
- **Firecrawl**: $100-200/month
- **OpenAI**: $50-100/month
- **Database**: Included in Railway or $25/month (Neon)

**Total:** $190-395/month

---

## Next Steps After Deployment

1. **Test full workflow** on production
2. **Set up monitoring** (Sentry, LogRocket)
3. **Add custom domain** (Vercel)
4. **Configure alerts** (Railway, Vercel)
5. **Set up CI/CD** (GitHub Actions)
6. **Add analytics** (PostHog, Mixpanel)
7. **Implement authentication** (see product review)

---

## Security Checklist

Before going live:

- [ ] Environment variables secured (not in code)
- [ ] `.env` in `.gitignore` ✅
- [ ] CORS configured properly
- [ ] Rate limiting on API endpoints (TODO)
- [ ] Input validation on all endpoints (partial)
- [ ] HTTPS enforced (Vercel/Railway default)
- [ ] Database connection secure (SSL)
- [ ] API keys rotated regularly
- [ ] Error messages don't leak sensitive info

---

## Maintenance

### Update Dependencies

```bash
npm update
npm audit fix
```

### Database Backups

Railway PostgreSQL includes daily backups. Manual backup:

```bash
# From Railway console
pg_dump $DATABASE_URL > backup.sql
```

### Monitoring API Usage

- **Firecrawl**: Check dashboard for credit usage
- **OpenAI**: Monitor usage at platform.openai.com/usage

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Firecrawl Docs**: https://docs.firecrawl.dev
- **Drizzle ORM**: https://orm.drizzle.team

---

**Ready to deploy! 🚀**

Follow the steps above and your PropertyPilot will be live in ~15 minutes!

