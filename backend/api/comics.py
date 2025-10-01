# backend/api/comics.py
from fastapi import APIRouter, Depends, HTTPException, Request
from schemas.comic import ComicArtRequest, ComicRequest
from services.comic_storage import ComicStorageService
from services.comic_generator import ComicArtGenerator
from auth_shared import get_current_user
import json
import base64
import os

router = APIRouter(prefix="/api/comics", tags=["comics"])

comic_generator = ComicArtGenerator()
comic_storage_service = ComicStorageService()

@router.post("/generate")
async def generate_comic_art(request: ComicArtRequest):
    """
    Generate comic art from text prompt and optional reference image
    """
    try:
        text_prompt = request.text_prompt
        reference_image_data = request.reference_image
        panel_id = request.panel_id
        previous_panel_context = request.previous_panel_context
        
        print(f"🔍 DEBUG: panel_id={panel_id}, has_previous_context={previous_panel_context is not None}")
        
        context_image_data = None
        
        if previous_panel_context:
            context_prompt = f"Create the next scene using this context: {previous_panel_context.prompt}. {text_prompt}"
            context_image_data = previous_panel_context.image_data
            text_prompt = context_prompt
            print(f"🎯 Using previous panel context for panel {panel_id}: {context_prompt[:100]}...")
        else:
            print(f"📝 Panel {panel_id} - no context used (first panel or no previous context provided)")
        
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
        
        # No need to store context - frontend handles continuity
        print(f"✅ Generated panel {panel_id} successfully")
        
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
async def save_comic(raw_request: Request, current_user: dict = Depends(get_current_user)):
    """
    Save a comic to the database
    Requires authentication via JWT token
    """
    try:
        # First, let's see the raw request data
        raw_data = await raw_request.json()
        print(f"🔍 DEBUG: Raw request data: {json.dumps(raw_data, indent=2)}")
        print(f"🔍 DEBUG: Raw data keys: {list(raw_data.keys())}")
        print(f"🔍 DEBUG: Authenticated user: {current_user.get('email', 'Unknown')} (ID: {current_user.get('id', 'Unknown')})")
        
        # Try to parse as ComicRequest to see validation errors
        try:
            request = ComicRequest(**raw_data)
            print(f"✅ Successfully parsed as ComicRequest")
        except Exception as validation_error:
            print(f"❌ Validation error: {validation_error}")
            print(f"📋 Expected schema: ComicRequest(title: str, panels: List[PanelData])")
            print(f"📋 PanelData schema: PanelData(id: int, prompt: str, image_data: str, is_zoomed: bool)")
            raise HTTPException(status_code=422, detail=f"Validation error: {str(validation_error)}")
        
        comic_title = request.title
        panels_data = request.panels
        
        if not all([comic_title, panels_data]):
            print(f"❌ Missing fields - comic_title: {comic_title}, panels_data: {bool(panels_data)}")
            raise HTTPException(status_code=400, detail='Missing required fields')
        
        # Convert Pydantic models to plain dicts for the storage layer
        try:
            panels_payload = [
                {
                    'id': p.id,
                    # Support both keys downstream: image_data and largeCanvasData
                    'image_data': p.image_data,
                    'prompt': p.prompt,
                    'is_zoomed': p.is_zoomed,
                    'narration': getattr(p, 'narration', None),
                    'audio_data': getattr(p, 'audio_data', None)
                }
                for p in panels_data
            ]
        except Exception as conv_err:
            print(f"❌ Error converting PanelData to dicts: {conv_err}")
            raise HTTPException(status_code=400, detail=f"Invalid panels data: {conv_err}")

        print(f"🔍 DEBUG: Prepared panels_payload count: {len(panels_payload)}")
        if panels_payload:
            print(f"🔍 DEBUG: First panel keys: {list(panels_payload[0].keys())}")
            print(f"🔍 DEBUG: First panel has narration: {bool(panels_payload[0].get('narration'))}")
            print(f"🔍 DEBUG: First panel has audio_data: {bool(panels_payload[0].get('audio_data'))}")
            if panels_payload[0].get('audio_data'):
                print(f"🔍 DEBUG: First panel audio_data length: {len(panels_payload[0]['audio_data'])}")

        # Use the authenticated user's ID
        user_id = current_user.get('id')

        return await comic_storage_service.save_comic(user_id, comic_title, panels_payload)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error saving comic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-comics")
async def get_user_comics(current_user: dict = Depends(get_current_user)):
    """
    Get all comics for the authenticated user from Supabase
    """
    try:
        user_id = current_user.get('id')
        print(f"🔍 DEBUG: Fetching comics for user: {user_id}")
        
        # Use the ComicStorageService to get user comics
        comics = await comic_storage_service.get_user_comics(user_id)
        
        print(f"✅ Found {len(comics)} comics for user {user_id}")
        return {'comics': comics}
        
    except Exception as e:
        print(f"❌ Error fetching user comics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/public-comics")
async def get_public_comics():
    """
    Get all public comics from all users for the explore page
    """
    try:
        print(f"🔍 DEBUG: Fetching public comics")
        
        # Use the ComicStorageService to get public comics
        comics = await comic_storage_service.get_public_comics()
        
        print(f"✅ Found {len(comics)} public comics")
        return {'comics': comics}
        
    except Exception as e:
        print(f"❌ Error fetching public comics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list-comics")
async def list_comics():
    """
    List all saved comics in the project directory
    """
    try:
        import glob
        
        # Look for saved comics directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        
        if not os.path.exists(saved_comics_dir):
            return {'comics': []}
        
        # Get all comic directories
        comic_dirs = [d for d in os.listdir(saved_comics_dir) 
                     if os.path.isdir(os.path.join(saved_comics_dir, d))]
        
        # Sort by modification time (newest first)
        comic_dirs.sort(key=lambda x: os.path.getmtime(os.path.join(saved_comics_dir, x)), reverse=True)
        
        comics = []
        for comic_dir in comic_dirs:
            # Check if it has panel files
            panel_files = glob.glob(os.path.join(saved_comics_dir, comic_dir, "panel_*.png"))
            if panel_files:
                # Check for panel 1 as cover image
                panel_1_path = os.path.join(saved_comics_dir, comic_dir, "panel_1.png")
                has_cover = os.path.exists(panel_1_path)
                
                comic_data = {
                    'title': comic_dir,
                    'panel_count': len(panel_files),
                    'has_cover': has_cover
                }
                
                # If panel 1 exists, include it as cover image
                if has_cover:
                    try:
                        with open(panel_1_path, 'rb') as f:
                            cover_bytes = f.read()
                            cover_base64 = base64.b64encode(cover_bytes).decode('utf-8')
                            comic_data['cover_image'] = f"data:image/png;base64,{cover_base64}"
                    except Exception as e:
                        print(f"⚠️ Error reading panel 1 as cover for {comic_dir}: {e}")
                
                comics.append(comic_data)
        
        return {'comics': comics}

    except Exception as e:
        print(f"❌ Error listing comics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
