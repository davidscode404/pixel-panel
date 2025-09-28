// API Configuration
// Change this port to easily switch between different backend servers
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Change this to 8000 or any other port as needed
  ENDPOINTS: {
    LOAD_COMIC: '/load-comic',
    SAVE_PANEL: '/save-panel',
    SAVE_COMIC: '/save-comic',
    GENERATE: '/generate',
    LIST_COMICS: '/list-comics',
    MY_COMICS: '/my-comics',
    RESET_CONTEXT: '/reset-context'
  }
};

// Simple cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
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
        } catch (e) {
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
        } catch (e) {
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
    console.log(`Using cached response for ${url}`);
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Make the actual API call
  console.log(`Making API call to ${url}${authToken ? ' (authenticated)' : ' (no auth)'}`);
  if (authToken) {
    console.log('🔑 Auth token preview:', authToken.substring(0, 20) + '...');
  } else {
    console.log('⚠️ No auth token available for API call');
  }
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
