from fastapi import HTTPException, FastAPI
import uvicorn
import logging
import sys

from fastapi.middleware.cors import CORSMiddleware

from api.comics import router as comics_router
from api.voice_over import router as voice_over_router
from api.stripe import router as stripe_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

app = FastAPI(title="PixelPanel", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

# Include the new API routers
app.include_router(comics_router)
app.include_router(voice_over_router)
app.include_router(stripe_router)

# Legacy endpoint, stores comics from local directory - needs to be updated to use the new database
# TODO: Remove this endpoint
@app.get("/load-comic/{comic_title}")
async def load_comic(comic_title: str):
    """
    Load a saved comic from the project directory
    """
    try:
        import os
        import base64
        import glob
        from urllib.parse import unquote
        
        # Decode URL-encoded comic title
        decoded_title = unquote(comic_title)
        logger.info(f"Loading comic: '{comic_title}' -> decoded: '{decoded_title}'")
        
        # Look for the comic directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        comic_dir = os.path.join(saved_comics_dir, decoded_title)
        
        logger.debug(f"Looking for comic directory: {comic_dir}")
        
        if not os.path.exists(comic_dir):
            # List available comics for debugging
            available_comics = []
            if os.path.exists(saved_comics_dir):
                available_comics = [d for d in os.listdir(saved_comics_dir) 
                                  if os.path.isdir(os.path.join(saved_comics_dir, d))]
            logger.warning(f"Comic not found. Available comics: {available_comics}")
            raise HTTPException(status_code=404, detail=f'Comic not found. Available: {available_comics}')
        
        # Load all panel images
        panels = []
        for panel_id in range(1, 7):  # 6 panels
            panel_path = os.path.join(comic_dir, f"panel_{panel_id}.png")
            if os.path.exists(panel_path):
                with open(panel_path, 'rb') as f:
                    image_bytes = f.read()
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    panels.append({
                        'id': panel_id,
                        'panel_number': panel_id,  # Add panel_number for compatibility
                        'image_data': f"data:image/png;base64,{image_base64}"
                    })
        
        return {
            'success': True,
            'comic_title': comic_title,
            'panels': panels
        }

    except Exception as e:
        logger.error(f"Error loading comic: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)