# PixelPanel - AI Comic Generator

Create comics with AI! Draw sketches, add text prompts, and let AI generate beautiful comic panels. Share your stories with the world.

## Quick Start

### 1. Prerequisites
- **Node.js 18+** and npm
- **Python 3.11+**
- **Supabase account** (free at [supabase.com](https://supabase.com))
- **Google AI API key** (free at [makersuite.google.com](https://makersuite.google.com))

### 2. Clone & Setup
```bash
git clone <repository-url>
cd ultimate-agents
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Frontend Setup
```bash
cd frontend
npm install
```

### 5. Environment Variables

**Backend** - Create `backend/.env`:
```env
GOOGLE_API_KEY="your_google_api_key"
SUPABASE_URL="your_supabase_url"
SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_key"
ELEVENLABS_API_KEY="your_elevenlabs_key"  # Optional
# Stripe (for billing/credits)
STRIPE_SECRET_KEY="sk_live_or_test_key"
STRIPE_WEBHOOK_SECRET="whsec_..."

# Dev helpers (optional)
DEV_MODE=true  # enables simple local testing endpoints
```

**Frontend** - Create `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_or_live_key"
```

### 6. Database Setup

1. **Create Supabase project** at [supabase.com](https://supabase.com)
2. **Run SQL scripts** in Supabase SQL Editor:
   ```sql
   -- Copy and paste the contents of these files:
   -- db/main.sql
   -- db/security/rls.sql  
   -- db/supabse_storage/storage_policies.sql
   ```
3. **Create storage bucket** named `PixelPanel` with public access

### 7. Run the App
```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

Visit `http://localhost:3000`

## Billing & Credits (Stripe)

Keep it simple:
- Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `backend/.env`.
- Configure a Stripe webhook to POST to `/api/stripe/webhook` on your deployed backend.
- Credit amounts map to plans (50/120/280/800) and are added on successful payment/renewal.

### Local Dev: Quick Credit Test (no Stripe needed)
With the backend running and `DEV_MODE=true` in `backend/.env`:

1) Check current credits
```bash
curl "http://localhost:8000/api/stripe/dev-get-credits?user_id=YOUR_USER_ID"
```

2) Simulate a purchase (adds credits immediately)
```bash
curl -X POST http://localhost:8000/api/stripe/dev-simulate-payment \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","packageId":"credits_120"}'
```

3) Verify credits increased
```bash
curl "http://localhost:8000/api/stripe/dev-get-credits?user_id=YOUR_USER_ID"
```

## How to Use

1. **Sign up** for an account
2. **Create a comic** - draw sketches or use text prompts
3. **Generate panels** with AI
4. **Add narrations** (optional)
5. **Publish** and share your comic!

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Flash
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth

## API Docs

Once running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Deployment

### Backend
Deploy to Railway, Render, or Heroku. Set environment variables in your platform.

### Frontend  
Deploy to Vercel or Netlify. Set environment variables in your platform.

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

MIT License - see [LICENSE](LICENSE) file.

## Need Help?

- Open an issue on GitHub
- Check the [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup
- Join discussions

---

**PixelPanel** - Bring your stories to life with AI!