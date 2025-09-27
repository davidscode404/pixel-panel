# backend/api/comics.py
from fastapi import APIRouter, Depends, HTTPException
from schemas.comic import ComicArtRequest, ComicResponse, ComicRequest
from services.comic_storage import ComicStorageService
from services.comic_generator import ComicArtGenerator
from api.auth import get_current_user

router = APIRouter(prefix="/api/comics", tags=["comics"])

# These will be set by main.py to avoid circular imports
comic_generator = None
comic_storage_service = None
comic_context = None

def set_services(generator, storage, context):
    """Set services from main.py to avoid circular imports"""
    global comic_generator, comic_storage_service, comic_context
    comic_generator = generator
    comic_storage_service = storage
    comic_context = context

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

@router.post("/generate")
async def generate_comic_art(request: ComicArtRequest):
    """
    Generate comic art from text prompt and optional reference image
    """
    try:
        # FastAPI automatically parses the JSON body into the Pydantic model
        text_prompt = request.text_prompt
        reference_image_data = request.reference_image
        panel_id = request.panel_id
        
        # Handle context tracking
        global comic_context
        
        print(f"🔍 DEBUG: panel_id={panel_id}, is_reset={comic_context['is_reset']}, panels_count={len(comic_context['panels'])}")
        
        # For panels after the first, use previous panel as context
        context_image_data = None
        
        if panel_id and not is_first_panel_generation(panel_id) and not comic_context["is_reset"]:
            previous_context = get_previous_panel_context(panel_id)
            if previous_context:
                # Use the previous panel's prompt and image as context
                context_prompt = f"Create the next scene using this context: {previous_context['prompt']}. {text_prompt}"
                context_image_data = previous_context['image']
                text_prompt = context_prompt
                print(f"🎯 Using previous panel context for panel {panel_id}: {context_prompt[:100]}...")
            else:
                print(f"⚠️ No previous panel context available for panel {panel_id}")
        else:
            print(f"📝 Panel {panel_id} - no context used (first panel or reset)")
        
        # Generate comic art using the service
        if not comic_generator:
            raise HTTPException(
                status_code=500,
                detail="Comic art generator not initialized"
            )
        
        # Generate the comic art with context
        image = comic_generator.generate_comic_art(text_prompt, reference_image_data, context_image_data)
        
        # Convert image to base64 for response
        img_base64 = comic_generator.image_to_base64(image)
        
        # Store the generated panel data for future context
        if panel_id:
            comic_context["panels"][panel_id] = {
                "prompt": text_prompt,
                "image": img_base64
            }
            comic_context["is_reset"] = False
            print(f"💾 Stored panel {panel_id} data for context (prompt: {text_prompt[:30]}...)")
        
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

@router.post("/save-comic")
async def save_comic(request: ComicRequest, current_user: dict = Depends(get_current_user)):
    """
    Save a comic to the database
    Requires authentication via JWT token
    """
    try:
        comic_title = request.title
        panels_data = request.panels
        
        if not all([comic_title, panels_data]):
            raise HTTPException(status_code=400, detail='Missing required fields')
        
        # Use the authenticated user's ID
        user_id = current_user.get('id')
        
        return await comic_storage_service.save_comic(user_id, comic_title, panels_data)
    except Exception as e:
        print(f"❌ Error saving comic: {e}")
        raise HTTPException(status_code=500, detail=str(e))