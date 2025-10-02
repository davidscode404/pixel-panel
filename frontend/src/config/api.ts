// API Configuration
// Change this port to easily switch between different backend servers
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', // Use environment variable for production
  ENDPOINTS: {
    // New modular API endpoints
    GENERATE: '/api/comics/generate',
    SAVE_COMIC: '/api/comics/save-comic',
    MY_COMICS: '/api/comics/user-comics',
    USER_COMICS: '/api/comics/user-comics',  // Alias for MY_COMICS
    PUBLIC_COMICS: '/api/comics/public-comics',
    LIST_COMICS: '/api/comics/list-comics',  // New endpoint for saved-comics directory
    GENERATE_VOICE: '/api/voice-over/generate-voiceover',
    
    // Stripe endpoints
    CREATE_PAYMENT_INTENT: '/create-payment-intent',
    
    // Legacy endpoints (still needed for compatibility)
    LOAD_COMIC: '/load-comic',  // Legacy endpoint in main.py
    SAVE_PANEL: '/save-panel',  // Legacy endpoint (if still needed)
    RESET_CONTEXT: '/reset-context',  // Legacy endpoint (if still needed)
    GENERATE_COMIC: '/generate-comic'  // Legacy endpoint (if still needed)
  }
};

// Export BASE_URL for direct use
export const API_URL = API_CONFIG.BASE_URL;

// Simple cache for API responses
const apiCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds cache

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Get auth token from Supabase - will be set by AuthProvider
let currentAuthToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  currentAuthToken = token;
};

const getAuthToken = (): string | null => {
  if (currentAuthToken) {
    return currentAuthToken;
  }
  
  // Fallback: try to get from localStorage
  if (typeof window === 'undefined') return null;
  
  try {
    // Check common Supabase auth storage keys
    const keys = [
      'sb-localhost-auth-token',
      'supabase.auth.token',
      'sb-auth-token'
    ];
    
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (data?.access_token) {
            return data.access_token;
          }
        } catch {
          continue;
        }
      }
    }
    
    // Last resort: scan all localStorage for Supabase auth
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('sb-') && key.includes('auth')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data?.access_token) {
            return data.access_token;
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.warn('Error getting auth token:', error);
  }
  
  return null;
};

// Cached fetch function with authentication
export const cachedFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const now = Date.now();
  
  // Add authentication headers
  const authToken = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };
  
  const requestOptions = {
    ...options,
    headers
  };
  
  const cacheKey = `${url}_${JSON.stringify(requestOptions)}`;
  
  // Check if we have a valid cached response
  const cached = apiCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Make the actual API call
  const response = await fetch(url, requestOptions);
  
  // Cache successful responses
  if (response.ok) {
    const data = await response.clone().json();
    apiCache.set(cacheKey, { data, timestamp: now });
  }
  
  return response;
};

// Clear cache function
export const clearApiCache = (url?: string) => {
  if (url) {
    // Clear specific URL cache
    for (const [key] of apiCache) {
      if (key.startsWith(url)) {
        apiCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    apiCache.clear();
  }
};
