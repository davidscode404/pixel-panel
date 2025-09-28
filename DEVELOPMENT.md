# Development Guide

This guide provides detailed information for developers working on the PixelPanel project.

## 🏗️ Project Overview

PixelPanel is a full-stack AI comic generation platform with the following architecture:

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: FastAPI with Python 3.11+
- **Database**: PostgreSQL with Supabase
- **Storage**: Supabase Storage
- **AI Services**: Google Gemini AI, ElevenLabs TTS

## 🚀 Development Setup

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.11+** and pip
- **Git** for version control
- **Supabase account** for database and auth
- **Google AI API key** for comic generation
- **ElevenLabs API key** (optional) for voice features

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ultimate-agents
   ```

2. **Set up backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Set up database**
   - Create Supabase project
   - Run `db/schema.sql` in Supabase SQL Editor
   - Set up storage bucket named `PixelPanel`

5. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   python main.py

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## 🏛️ Architecture Patterns

### Backend Architecture

The backend follows **Clean Architecture** principles:

```
┌─────────────────┐
│   API Layer     │ ← FastAPI routes, request/response handling
├─────────────────┤
│  Service Layer  │ ← Business logic, AI integration
├─────────────────┤
│  Data Layer     │ ← Database models, storage services
└─────────────────┘
```

**Key Principles:**
- **Separation of Concerns**: Each layer has a specific responsibility
- **Dependency Injection**: Services are injected into routes
- **Configuration Management**: Centralized settings with Pydantic
- **Error Handling**: Consistent error responses and logging

### Frontend Architecture

The frontend follows **Component-Based Architecture**:

```
┌─────────────────┐
│   Pages Layer   │ ← Next.js App Router pages
├─────────────────┤
│ Components Layer│ ← Reusable UI components
├─────────────────┤
│  Services Layer │ ← API client, utilities
├─────────────────┤
│   Types Layer   │ ← TypeScript definitions
└─────────────────┘
```

**Key Principles:**
- **Component Composition**: Build complex UIs from simple components
- **Type Safety**: Full TypeScript coverage
- **State Management**: React Context for global state
- **API Abstraction**: Centralized API client

## 🔧 Development Workflow

### Git Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add new comic generation feature"
   ```

3. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

### Code Style

#### Backend (Python)
- **PEP 8** style guidelines
- **Type hints** for all functions
- **Docstrings** for classes and functions
- **Black** for code formatting

#### Frontend (TypeScript/React)
- **ESLint** and **Prettier** configuration
- **TypeScript strict mode**
- **Functional components** with hooks
- **Tailwind CSS** for styling

### Testing Strategy

#### Backend Testing
```bash
# Unit tests
python -m pytest tests/unit/

# Integration tests
python -m pytest tests/integration/

# API tests
python -m pytest tests/api/
```

#### Frontend Testing
```bash
# Component tests
npm run test

# E2E tests
npm run test:e2e

# Visual regression tests
npm run test:visual
```

## 🛠️ Common Development Tasks

### Adding a New API Endpoint

1. **Create route handler** in `backend/api/routes/`
2. **Add business logic** in `backend/services/`
3. **Update API client** in `frontend/src/lib/api.ts`
4. **Add types** in `frontend/src/types/index.ts`
5. **Test the endpoint**

### Adding a New UI Component

1. **Create component** in `frontend/src/components/`
2. **Add TypeScript types** in `frontend/src/types/index.ts`
3. **Style with Tailwind CSS**
4. **Add to component library**
5. **Write tests**

### Database Schema Changes

1. **Create migration** in `db/migrations/`
2. **Update models** in `backend/models/`
3. **Update schemas** in `backend/schemas/`
4. **Test migration**
5. **Update documentation**

## 🔍 Debugging

### Backend Debugging

```bash
# Run with debug logging
DEBUG=true python main.py

# Use Python debugger
import pdb; pdb.set_trace()

# Check logs
tail -f logs/app.log
```

### Frontend Debugging

```bash
# Development mode with source maps
npm run dev

# Use React DevTools
# Install browser extension

# Check network requests
# Use browser DevTools Network tab
```

### Database Debugging

```sql
-- Check table structure
\d comics

-- View recent data
SELECT * FROM comics ORDER BY created_at DESC LIMIT 10;

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'comics';
```

## 🚀 Performance Optimization

### Backend Optimization

- **Database indexing** for frequently queried columns
- **Connection pooling** for database connections
- **Caching** for expensive operations
- **Async/await** for I/O operations
- **Response compression** for large payloads

### Frontend Optimization

- **Code splitting** with dynamic imports
- **Image optimization** with Next.js Image component
- **Bundle analysis** to identify large dependencies
- **Lazy loading** for non-critical components
- **Service worker** for offline functionality

## 🔒 Security Considerations

### Backend Security

- **Input validation** with Pydantic
- **SQL injection prevention** with ORM
- **JWT token validation**
- **Rate limiting** for API endpoints
- **CORS configuration**

### Frontend Security

- **XSS prevention** with proper escaping
- **CSRF protection** with tokens
- **Secure storage** of sensitive data
- **Content Security Policy**
- **HTTPS enforcement**

## 📊 Monitoring and Logging

### Backend Monitoring

```python
# Structured logging
import logging
logging.basicConfig(level=logging.INFO)

# Health checks
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### Frontend Monitoring

```typescript
// Error boundary
class ErrorBoundary extends React.Component {
  // Error handling logic
}

// Analytics
// Google Analytics or similar
```

## 🧪 Testing Best Practices

### Backend Testing

- **Unit tests** for business logic
- **Integration tests** for API endpoints
- **Mock external services** (AI APIs)
- **Test database** with fixtures
- **Coverage reporting**

### Frontend Testing

- **Component tests** with React Testing Library
- **Integration tests** for user flows
- **Visual regression tests**
- **Accessibility tests**
- **Performance tests**

## 📚 Documentation

### Code Documentation

- **README files** for each major component
- **API documentation** with OpenAPI/Swagger
- **Type definitions** with JSDoc
- **Architecture diagrams** with Mermaid
- **Deployment guides**

### User Documentation

- **Getting started guide**
- **Feature documentation**
- **Troubleshooting guide**
- **FAQ section**
- **Video tutorials**

## 🤝 Contributing Guidelines

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch**
3. **Write tests** for new features
4. **Update documentation**
5. **Submit pull request**
6. **Address review feedback**

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Backward compatibility maintained

## 🚨 Troubleshooting

### Common Issues

#### Backend Issues
- **Import errors**: Check Python path and virtual environment
- **Database connection**: Verify Supabase credentials
- **API key errors**: Check environment variables
- **CORS issues**: Update CORS configuration

#### Frontend Issues
- **Build errors**: Check TypeScript types and dependencies
- **Runtime errors**: Check browser console and network tab
- **Styling issues**: Verify Tailwind CSS configuration
- **Authentication issues**: Check Supabase configuration

### Getting Help

- **Check existing issues** on GitHub
- **Search documentation**
- **Ask in discussions**
- **Create detailed issue** with reproduction steps

## 📈 Future Improvements

### Technical Debt
- **Refactor legacy code**
- **Improve test coverage**
- **Optimize database queries**
- **Enhance error handling**

### Feature Enhancements
- **Real-time collaboration**
- **Advanced AI features**
- **Mobile app development**
- **Performance optimizations**

---

This guide should help you get started with PixelPanel development. For specific questions, refer to the individual README files in each directory or create an issue on GitHub.
