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
```

**Frontend** - Create `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
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