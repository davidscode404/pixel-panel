from fastapi import HTTPException, FastAPI, UploadFile, File, Request, Response, Depends
import uvicorn
import base64
import PIL
from PIL import Image
from io import BytesIO
import os
import tempfile
import json
import asyncio
import glob
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import sys
import google.generativeai as genai
from google.generativeai import types
from services.comic_generator import ComicArtGenerator
from services.comic_storage import ComicStorageService
from supabase import create_client, Client
import jwt
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import the new API routers
from api.comics import router as comics_router
from api.voice_over import router as voice_over_router

app = FastAPI(title="PixelPanel", version="1.0.0")

# Initialize services
comic_generator = ComicArtGenerator()
comic_storage_service = ComicStorageService()

# Initialize Supabase client for JWT verification
supabase_url = os.getenv('SUPABASE_URL')
supabase_anon_key = os.getenv('SUPABASE_ANON_KEY')

supabase: Client = create_client(supabase_url, supabase_anon_key)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include the new API routers
app.include_router(comics_router)
app.include_router(voice_over_router)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

# Context tracking for comic generation (preserving existing functionality)
comic_context = {
    "panels": [],
    "current_panel": 0,
    "total_panels": 0,
    "story_prompt": "",
    "user_id": None
}

# Preserve existing functionality - these endpoints are still used by the current UI
@app.get("/load-comic/{comic_title}")
async def load_comic(comic_title: str):
    """
    Load a saved comic from the project directory
    """
    try:
        import glob
        from urllib.parse import unquote
        
        # Decode URL-encoded comic title
        decoded_title = unquote(comic_title)
        print(f"Loading comic: '{comic_title}' -> decoded: '{decoded_title}'")
        
        # Look for the comic directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        comic_dir = os.path.join(saved_comics_dir, decoded_title)
        
        print(f"Looking for comic directory: {comic_dir}")
        
        if not os.path.exists(comic_dir):
            raise HTTPException(status_code=404, detail=f"Comic '{decoded_title}' not found")
        
        # Find all panel images
        panel_pattern = os.path.join(comic_dir, "panel_*.png")
        panel_files = sorted(glob.glob(panel_pattern))
        
        if not panel_files:
            raise HTTPException(status_code=404, detail=f"No panels found for comic '{decoded_title}'")
        
        panels = []
        for i, panel_file in enumerate(panel_files):
            try:
                with open(panel_file, "rb") as f:
                    image_data = f.read()
                    img_base64 = base64.b64encode(image_data).decode('utf-8')
                    panels.append({
                        "id": i + 1,
                        "panel_number": i + 1,
                        "image_data": img_base64
                    })
            except Exception as e:
                print(f"Error reading panel {panel_file}: {e}")
                continue
        
        return {
            "title": decoded_title,
            "panels": panels,
            "panel_count": len(panels)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error loading comic: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading comic: {str(e)}")

@app.get("/list-comics")
async def list_comics():
    """
    List all available comics from the saved-comics directory
    """
    try:
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        
        if not os.path.exists(saved_comics_dir):
            return {"comics": []}
        
        comics = []
        for item in os.listdir(saved_comics_dir):
            item_path = os.path.join(saved_comics_dir, item)
            if os.path.isdir(item_path):
                # Check if it has panel images
                panel_pattern = os.path.join(item_path, "panel_*.png")
                panel_files = glob.glob(panel_pattern)
                
                if panel_files:
                    # Get the first panel as cover
                    cover_image = None
                    try:
                        with open(sorted(panel_files)[0], "rb") as f:
                            image_data = f.read()
                            img_base64 = base64.b64encode(image_data).decode('utf-8')
                            cover_image = f"data:image/png;base64,{img_base64}"
                    except Exception as e:
                        print(f"Error reading cover for {item}: {e}")
                    
                    comics.append({
                        "title": item,
                        "panel_count": len(panel_files),
                        "has_cover": cover_image is not None,
                        "cover_image": cover_image
                    })
        
        return {"comics": comics}
        
    except Exception as e:
        print(f"Error listing comics: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing comics: {str(e)}")

# Preserve existing voice generation functionality
@app.post("/generate-voice")
async def generate_voice(request: Request):
    """
    Generate voice for comic panels using ElevenLabs API
    """
    try:
        data = await request.json()
        text = data.get("text", "")
        voice_id = data.get("voice_id", "21m00Tcm4TlvDq8ikWAM")  # Default voice
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # ElevenLabs API configuration
        elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        if not elevenlabs_api_key:
            raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        
        payload = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Voice generation failed")
            
            audio_data = response.content
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            return {
                "audio_data": audio_base64,
                "text": text,
                "voice_id": voice_id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating voice: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating voice: {str(e)}")

# Legacy comic generation endpoint (preserving existing functionality)
@app.post("/generate-comic")
async def generate_comic(request: Request):
    """
    Generate a complete comic from a story prompt
    """
    try:
        data = await request.json()
        story_prompt = data.get("story_prompt", "")
        num_panels = data.get("num_panels", 6)
        user_id = data.get("user_id")
        
        if not story_prompt:
            raise HTTPException(status_code=400, detail="Story prompt is required")
        
        # Initialize comic context
        comic_context["story_prompt"] = story_prompt
        comic_context["total_panels"] = num_panels
        comic_context["current_panel"] = 0
        comic_context["panels"] = []
        comic_context["user_id"] = user_id
        
        # Generate panels
        panels = []
        for i in range(num_panels):
            panel_prompt = f"Panel {i+1} of {num_panels}: {story_prompt}"
            
            # Generate comic art
            image = comic_generator.generate_comic_art(panel_prompt)
            img_base64 = comic_generator.image_to_base64(image)
            
            panels.append({
                "panel_number": i + 1,
                "image_data": img_base64,
                "prompt": panel_prompt
            })
            
            comic_context["panels"].append({
                "panel_number": i + 1,
                "image_data": img_base64,
                "prompt": panel_prompt
            })
            comic_context["current_panel"] = i + 1
        
        return {
            "title": story_prompt[:50] + "...",
            "panels": panels,
            "panel_count": len(panels)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating comic: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating comic: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)