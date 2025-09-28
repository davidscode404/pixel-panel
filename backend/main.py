from fastapi import HTTPException, FastAPI, UploadFile, File, Request, Response, Depends
import uvicorn
import asyncio
from dotenv import load_dotenv
import os
import tempfile
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import sys
import google.generativeai as genai
from google.generativeai import types
import json
from typing import List, Optional
from services.comic_generator import ComicArtGenerator
from services.comic_storage import ComicStorageService
from supabase import create_client, Client
import jwt
from auth_shared import get_current_user

# Import the new API routers
from api.comics import router as comics_router
from api.voice_over import router as voice_over_router

# Load environment variables from .env file
load_dotenv()

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

# Context tracking for comic generation (keeping for backwards compatibility)
comic_context = {
    "panels": {},  # Store all generated panels: {panel_id: {"prompt": str, "image": str}}
    "is_reset": True
}

def reset_comic_context():
    """Reset the comic context when all panels are cleared"""
    global comic_context
    comic_context = {
        "panels": {},
        "is_reset": True
    }
    print("🔄 Comic context reset")

def is_first_panel_generation(panel_id: int) -> bool:
    """Check if this is the first panel being generated (panel 1)"""
    return panel_id == 1

def get_previous_panel_context(panel_id: int):
    """Get the context from the previous panel"""
    global comic_context
    previous_panel_id = panel_id - 1
    if previous_panel_id in comic_context["panels"]:
        return comic_context["panels"][previous_panel_id]
    return None

# Legacy endpoints for backwards compatibility
class ComicArtRequest(BaseModel):
    text_prompt: str
    reference_image: str = None  # Base64 encoded image data (optional)
    panel_id: int = None  # Panel ID to track generation order

@app.post("/generate")
async def generate_comic_art(request: ComicArtRequest):
    """
    Generate comic art from text prompt and optional reference image
    Legacy endpoint - redirects to new API
    """
    try:
        # Handle context tracking
        global comic_context
        
        print(f"🔍 DEBUG: panel_id={request.panel_id}, is_reset={comic_context['is_reset']}, panels_count={len(comic_context['panels'])}")
        
        # For panels after the first, use previous panel as context
        context_image_data = None
        
        if request.panel_id and not is_first_panel_generation(request.panel_id) and not comic_context["is_reset"]:
            previous_context = get_previous_panel_context(request.panel_id)
            if previous_context:
                # Use the previous panel's prompt and image as context
                context_prompt = f"Create the next scene using this context: {previous_context['prompt']}. {request.text_prompt}"
                context_image_data = previous_context['image']
                request.text_prompt = context_prompt
                print(f"🎯 Using previous panel context for panel {request.panel_id}: {context_prompt[:100]}...")
            else:
                print(f"⚠️ No previous panel context available for panel {request.panel_id}")
        else:
            print(f"📝 Panel {request.panel_id} - no context used (first panel or reset)")
        
        # Generate comic art using the service
        if not comic_generator:
            raise HTTPException(
                status_code=500,
                detail="Comic art generator not initialized"
            )
        
        # Generate the comic art with context
        image = comic_generator.generate_comic_art(request.text_prompt, request.reference_image, context_image_data)
        
        # Convert image to base64 for response
        img_base64 = comic_generator.image_to_base64(image)
        
        # Store the generated panel data for future context
        if request.panel_id:
            comic_context["panels"][request.panel_id] = {
                "prompt": request.text_prompt,
                "image": img_base64
            }
            comic_context["is_reset"] = False
            print(f"💾 Stored panel {request.panel_id} data for context (prompt: {request.text_prompt[:30]}...)")
        
        return {
            'success': True,
            'image_data': img_base64,
            'message': 'Comic art generated successfully'
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error in generate endpoint: {e}")
        print(f"📋 Full traceback: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating comic art: {str(e)}"
        )

@app.post("/auto-complete")
async def auto_complete(
    image_c1: UploadFile = File(...),
    image_c2: UploadFile = None,
    image_c3: UploadFile = None,
    image_c4: UploadFile = None,
    image_c5: UploadFile = None):
    """
    Auto-complete a comic panel based on the images provided
    """
    images = []
    for image in [image_c1, image_c2, image_c3, image_c4, image_c5]:
        if image is None:
            continue
        images.append(image)

    # Generate a story summary from the images
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_API_KEY environment variable not set"
        )
    genai.configure(api_key=google_api_key)

    contents_for_gemini = []
    for image in images:
        contents_for_gemini.append(types.Part.from_bytes(
            data=image.file.read(),
            mime_type='image/png'
        ))

    contents_for_gemini.append(types.Part(text="Generate a story summary from the images"))

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(contents_for_gemini)
    print(response.text)
    return {'story_summary': response.text}

@app.post("/reset-context")
async def reset_context():
    """
    Reset the comic context when all panels are cleared
    """
    try:
        reset_comic_context()
        return {
            'success': True,
            'message': 'Comic context reset successfully'
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# Legacy endpoints that redirect to new API
@app.post("/save-comic")
async def save_comic(request: Request, current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to new API"""
    try:
        data = await request.json()
        from api.comics import save_comic as new_save_comic
        from schemas.comic import ComicRequest
        
        comic_request = ComicRequest(
            comic_title=data.get('comic_title'),
            panels_data=data.get('panels_data')
        )
        return await new_save_comic(comic_request, current_user)
    except Exception as e:
        print(f"❌ Error saving comic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/list-comics")
async def list_comics():
    """Legacy endpoint - redirects to new API"""
    from api.comics import get_all_comics
    return await get_all_comics()

@app.get("/my-comics")
async def my_comics(current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to new API"""
    from api.comics import get_user_comics
    return await get_user_comics(current_user)

@app.get("/load-comic/{comic_title}")
async def load_comic(comic_title: str):
    """Legacy endpoint - redirects to new API"""
    from api.comics import load_comic as new_load_comic
    return await new_load_comic(comic_title)

@app.post("/save-panel")
async def save_panel(request: Request, current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to new API"""
    try:
        data = await request.json()
        from api.comics import save_panel as new_save_panel
        from schemas.comic import ComicRequest
        
        comic_request = ComicRequest(
            comic_title=data.get('comic_title'),
            panel_id=data.get('panel_id'),
            image_data=data.get('image_data')
        )
        return await new_save_panel(comic_request, current_user)
    except Exception as e:
        print(f"Error saving panel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-voiceover")
async def generate_voiceover(
    voiceover_text: str,
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb"
):
    """Legacy endpoint - redirects to new API"""
    from api.voice_over import generate_voiceover as new_generate_voiceover
    return await new_generate_voiceover(voiceover_text, voice_id)

@app.post("/video-gen")
def generate_video(prompt: str, image_path: str):
    """Legacy video generation endpoint"""
    # Note: This endpoint requires fal_client which is not currently installed
    # Keeping as placeholder for future implementation
    return {"message": "Video generation endpoint - requires fal_client setup"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)