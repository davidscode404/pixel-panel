# PixelPanel - AI Comic Generator

Create AI-powered comics with sketches and text prompts. Generate panels, add narrations, and share your stories.

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account
- Google AI API key
- Stripe account (for billing)
- ElevenLabs API key (for voice-overs)

### Setup

1. **Clone the repo**
   ```bash
   git clone <repository-url>
   cd ultimate-agents
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

   Create `backend/.env`:
   ```env
   # Supabase
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key

   # AI Keys
   GOOGLE_API_KEY=your_google_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_key

   # Stripe
   STRIPE_SECRET_KEY=sk_test_or_live_key
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_STARTER_PRICE_ID=price_...
   STRIPE_PRO_PRICE_ID=price_...
   STRIPE_CREATOR_PRICE_ID=price_...
   STRIPE_CONTENT_MACHINE_PRICE_ID=price_...

   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_or_live_key
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Database Setup**
   - Create Supabase project
   - Run SQL scripts in order:
     - `db/main.sql`
     - `db/security/rls.sql`
     - `db/supabse_storage/storage_policies.sql`
   - Create storage bucket named `PixelPanel` (public access)

5. **Run the App**
   ```bash
   # Terminal 1 - Backend
   cd backend
   source .venv/bin/activate
   uvicorn main:app --reload

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

   Visit `http://localhost:3000`

## Features

- 🎨 Create comics with AI-generated panels
- ✏️ Draw sketches or use text prompts
- 🎙️ Add AI voice narrations
- 💳 Subscription-based credits system
- 👤 User profiles and authentication
- 📚 Explore and share comics

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Stripe
- **Backend**: FastAPI, Python
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Flash, ElevenLabs
- **Auth**: Supabase Auth
- **Payments**: Stripe

## License

MIT License - see [LICENSE](LICENSE) file.