// API Configuration
// Change this port to easily switch between different backend servers
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Change this to 8000 or any other port as needed
  ENDPOINTS: {
    LOAD_COMIC: '/load-comic',
    SAVE_COMIC: '/api/comics/save-comic',
    GENERATE: '/api/comics/generate',
    LIST_COMICS: '/api/comics/list-comics',
    USER_COMICS: '/api/comics/user-comics'
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
