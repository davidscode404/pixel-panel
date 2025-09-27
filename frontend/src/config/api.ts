// API Configuration
// Change this port to easily switch between different backend servers
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Change this to 8000 or any other port as needed
  ENDPOINTS: {
    LOAD_COMIC: '/load-comic',
    SAVE_PANEL: '/save-panel',
    SAVE_COMIC: '/api/comics/save-comic',
    GENERATE: '/api/comics/generate',
    LIST_COMICS: '/api/comics/list-comics',
    RESET_CONTEXT: '/reset-context',
    USER_COMICS: '/user-comics'
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
