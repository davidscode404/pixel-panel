# PixelPanel - AI Comic Generator

PixelPanel is an AI-powered comic generation platform that allows users to create comics through voice input and text prompts. The application uses advanced AI models to generate comic art, manage user authentication, and store comics in the cloud.

## 🚀 Features

- **AI Comic Generation**: Generate comic panels using Google's Gemini AI
- **Voice-to-Comic**: Convert voice input to comic stories
- **Context-Aware Generation**: Maintain visual consistency across comic panels
- **User Authentication**: Secure user management with Supabase Auth
- **Cloud Storage**: Store and manage comics in Supabase Storage
- **Real-time Collaboration**: Share and collaborate on comics
- **Responsive Design**: Modern, mobile-friendly interface

## 🏗️ Architecture

### Backend (FastAPI)
- **API Routes**: Organized into comics, audio, and AI endpoints
- **Services**: Comic generation, storage, and audio processing
- **Authentication**: JWT-based auth with Supabase
- **Database**: PostgreSQL with Supabase
- **Storage**: Supabase Storage for images and files

### Frontend (Next.js)
- **React Components**: Modular, reusable UI components
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Modern, responsive styling
- **State Management**: React Context for authentication
- **API Client**: Centralized API communication

### Database (PostgreSQL)
- **Tables**: Comics, panels, users, likes, comments
- **Security**: Row Level Security (RLS) policies
- **Indexes**: Optimized for performance
- **Migrations**: Version-controlled schema changes

## 🛠️ Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Supabase**: Backend-as-a-Service (Auth, Database, Storage)
- **Google Gemini AI**: Comic art generation
- **ElevenLabs**: Text-to-speech
- **Pillow**: Image processing
- **Pydantic**: Data validation

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Supabase Client**: Real-time database and auth

### Database
- **PostgreSQL**: Relational database
- **Supabase**: Managed PostgreSQL with real-time features
- **Row Level Security**: Data access control

## 📁 Project Structure

```
ultimate-agents/
├── backend/                 # FastAPI backend
│   ├── api/                # API routes and dependencies
│   │   └── routes/         # Route handlers (comics, audio, ai)
│   ├── core/               # Core utilities
│   │   ├── security.py     # Authentication utilities
│   │   └── database.py     # Database configuration
│   ├── services/           # Business logic services
│   │   ├── comic_generator.py
│   │   └── comic_storage.py
│   ├── models/             # Database models
│   ├── schemas/            # Pydantic schemas
│   ├── config.py           # Application configuration
│   └── main.py             # FastAPI application
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # React components
│   │   │   ├── auth/       # Authentication components
│   │   │   └── ui/         # Reusable UI components
│   │   ├── lib/            # Utilities and API client
│   │   ├── types/          # TypeScript type definitions
│   │   └── config/         # Configuration files
│   └── public/             # Static assets
├── db/                     # Database files
│   ├── schema.sql          # Complete database schema
│   ├── migrations/         # Database migrations
│   ├── security/           # RLS policies
│   └── supabse_storage/    # Storage policies
└── saved-comics/           # Local comic storage
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Supabase account
- Google AI API key
- ElevenLabs API key (optional)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ultimate-agents
   ```

2. **Set up Python environment**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and Supabase credentials
   ```

4. **Run the backend**
   ```bash
   python main.py
   ```

### Frontend Setup

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Run the frontend**
   ```bash
   npm run dev
   ```

### Database Setup

1. **Create Supabase project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Get your project URL and API keys

2. **Run database migrations**
   ```sql
   -- In Supabase SQL Editor
   \i db/schema.sql
   \i db/security/rls.sql
   \i db/supabse_storage/storage_policies.sql
   ```

3. **Set up storage bucket**
   - Create a bucket named `PixelPanel`
   - Configure public access if needed

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# API Configuration
API_TITLE="PixelPanel API"
API_VERSION="1.0.0"
DEBUG=false

# External API Keys
GOOGLE_API_KEY="your_google_api_key"
ELEVENLABS_API_KEY="your_elevenlabs_api_key"

# Supabase Configuration
SUPABASE_URL="your_supabase_url"
SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_KEY="your_supabase_service_key"
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

## 📚 API Documentation

Once the backend is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints

- `POST /comics/generate` - Generate comic art
- `POST /comics/save` - Save complete comic
- `POST /comics/save-panel` - Save individual panel
- `GET /comics/list` - List user's comics
- `POST /audio/generate-voiceover` - Generate voiceover
- `POST /ai/auto-complete` - Auto-complete comic story

## 🧪 Testing

### Backend Testing
```bash
cd backend
python -m pytest
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 🚀 Deployment

### Backend Deployment
- Deploy to services like Railway, Render, or Heroku
- Set environment variables in your deployment platform
- Ensure database migrations are run

### Frontend Deployment
- Deploy to Vercel, Netlify, or similar
- Set environment variables in your deployment platform
- Update API URLs for production

### Database Deployment
- Use Supabase's managed PostgreSQL
- Run migrations in production
- Set up proper RLS policies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for comic generation
- Supabase for backend services
- ElevenLabs for text-to-speech
- The open-source community for amazing tools and libraries

## 📞 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Check the documentation
- Join our community discussions

---

**PixelPanel** - Bringing your stories to life with AI! 🎨✨