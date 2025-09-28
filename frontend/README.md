# PixelPanel Frontend

Next.js 15 frontend application for the PixelPanel AI comic generation platform.

## 🏗️ Architecture

The frontend follows modern React patterns with Next.js App Router:

```
frontend/src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   ├── protected/         # Protected user pages
│   ├── preview/           # Comic preview pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── auth/              # Authentication components
│   ├── ui/                # Reusable UI components
│   └── BookSlider.tsx     # Comic showcase component
├── lib/                   # Utilities and services
│   ├── api.ts             # API client
│   ├── utils.ts           # Utility functions
│   └── supabase/          # Supabase client
├── types/                 # TypeScript type definitions
└── config/                # Configuration files
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the frontend directory:

```env
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url_here"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
```

### API Configuration

Update `src/config/api.ts` to point to your backend:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Your backend URL
  // ... other config
};
```

## 🛠️ Development

### Code Structure

#### Pages (App Router)
- **Home**: Landing page with authentication
- **Auth**: Login, signup, and password reset
- **Protected**: User dashboard and comic creation
- **Preview**: Comic viewing and sharing

#### Components
- **Auth**: Authentication forms and providers
- **UI**: Reusable components (Button, Input, Modal)
- **Layout**: Page layouts and navigation

#### Services
- **API Client**: Centralized API communication
- **Supabase**: Database and authentication
- **Utils**: Helper functions and utilities

### Key Features

#### Authentication
- Supabase Auth integration
- Protected routes
- User context management
- Automatic redirects

#### Comic Management
- Comic creation and editing
- Panel generation with AI
- Save and load functionality
- Comic sharing and preview

#### UI/UX
- Responsive design with Tailwind CSS
- Modern, accessible components
- Loading states and error handling
- Smooth animations and transitions

### Adding New Features

1. **Create page** in `app/` directory
2. **Add components** in `components/`
3. **Update types** in `types/index.ts`
4. **Add API methods** in `lib/api.ts`
5. **Update navigation** if needed

### Styling

The application uses Tailwind CSS for styling:

- **Utility-first approach**
- **Responsive design**
- **Dark/light theme support**
- **Custom component classes**

### State Management

- **React Context** for authentication
- **Local state** with useState/useReducer
- **Server state** with API calls
- **Form state** with controlled components

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Deployment Platforms

#### Vercel (Recommended)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

#### Netlify
1. Build command: `npm run build`
2. Publish directory: `.next`
3. Set environment variables

#### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Builds

- **Development**: Hot reload, debug tools
- **Staging**: Production build with staging API
- **Production**: Optimized build with production API

## 🔒 Security

### Authentication
- JWT tokens stored securely
- Protected routes and API calls
- Automatic token refresh
- Secure logout functionality

### Data Protection
- Input validation and sanitization
- XSS prevention
- CSRF protection
- Secure API communication

### Privacy
- User data handling compliance
- Secure file uploads
- Privacy-focused analytics

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Features
- Touch-friendly interfaces
- Optimized images
- Progressive Web App (PWA) ready
- Offline functionality

## 🎨 UI/UX Guidelines

### Design System
- Consistent color palette
- Typography hierarchy
- Spacing and layout rules
- Component variants

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode

### Performance
- Code splitting
- Image optimization
- Lazy loading
- Bundle size optimization

## 🤝 Contributing

1. Follow React and Next.js best practices
2. Use TypeScript for type safety
3. Write tests for components
4. Follow the established code style
5. Update documentation

## 📄 License

This project is licensed under the MIT License.