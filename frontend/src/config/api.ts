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

// Cached fetch function
export const cachedFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const now = Date.now();
  const cacheKey = `${url}_${JSON.stringify(options || {})}`;
  
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
  console.log(`Making API call to ${url}`);
  const response = await fetch(url, options);
  
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
