# backend/api/comics.py
from fastapi import APIRouter, Depends, HTTPException, Request
from schemas.comic import ComicArtRequest, ComicRequest, ThumbnailRequest
from services.comic_storage import ComicStorageService
from services.comic_generator import ComicArtGenerator
from auth_shared import get_current_user
import json
import base64
import os
import logging
from PIL import Image
import io

logger = logging.getLogger(__name__)

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
        
        logger.debug(f"panel_id={panel_id}, has_previous_context={previous_panel_context is not None}")
        
        context_image_data = None
        
        if previous_panel_context:
            context_prompt = f"Create the next scene using this context: {previous_panel_context.prompt}. {text_prompt}"
            context_image_data = previous_panel_context.image_data
            text_prompt = context_prompt
            logger.info(f"Using previous panel context for panel {panel_id}: {context_prompt[:100]}...")
        else:
            logger.info(f"Panel {panel_id} - no context used (first panel or no previous context provided)")
        
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
        logger.info(f"Generated panel {panel_id} successfully")
        
        return {
            'success': True,
            'image_data': img_base64,
            'message': 'Comic art generated successfully'
        }
        
    except Exception as e:
        logger.error(f"Error in generate endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error generating comic art: {str(e)}"
        )

@router.post("/generate-thumbnail")
async def generate_thumbnail(request: ThumbnailRequest):
    """
    Generate a thumbnail image based on comic prompts
    Returns a 3:4 aspect ratio image suitable for comic book covers
    """
    try:
        # Combine all prompts into a single prompt for thumbnail generation
        combined_prompt = f"Comic book cover art featuring: {', '.join(request.prompts[:3])}"  # Use first 3 prompts
        logger.debug(f"Generating thumbnail with prompt: {combined_prompt}")

        # Generate comic art using the service
        if not comic_generator:
            raise HTTPException(
                status_code=500,
                detail="Comic art generator not initialized"
            )

        # Generate the thumbnail
        image = comic_generator.generate_comic_art(combined_prompt, None, None)

        # Resize to 3:4 aspect ratio (e.g., 600x800)
        target_width = 600
        target_height = 800
        image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)

        # Convert image to base64 for response
        img_base64 = comic_generator.image_to_base64(image)

        logger.info("Generated thumbnail successfully")

        return {
            'success': True,
            'thumbnail_data': img_base64,
            'message': 'Thumbnail generated successfully'
        }

    except Exception as e:
        logger.error(f"Error in generate thumbnail endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error generating thumbnail: {str(e)}"
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
        logger.debug(f"Raw request data: {json.dumps(raw_data, indent=2)}")
        logger.debug(f"Raw data keys: {list(raw_data.keys())}")
        logger.info(f"Authenticated user: {current_user.get('email', 'Unknown')} (ID: {current_user.get('id', 'Unknown')})")
        
        # Handle both old and new frontend formats
        comic_title = raw_data.get('title') or raw_data.get('comic_title')
        panels_data = raw_data.get('panels') or raw_data.get('panels_data')
        
        if not comic_title:
            raise HTTPException(status_code=422, detail="Missing required field: title or comic_title")
        if not panels_data:
            raise HTTPException(status_code=422, detail="Missing required field: panels or panels_data")
        
        logger.info(f"Extracted - comic_title: {comic_title}, panels_count: {len(panels_data)}")

        # Convert Pydantic models to plain dicts for the storage layer, supporting voice-over features
        try:
            panels_payload = [
                {
                    'id': p.id if hasattr(p, 'id') else p.get('id', 1),
                    'image_data': p.image_data if hasattr(p, 'image_data') else (p.get('image_data') or p.get('largeCanvasData')),
                    'prompt': p.prompt if hasattr(p, 'prompt') else p.get('prompt', f"Panel {p.get('id', 1)}"),
                    'is_zoomed': p.is_zoomed if hasattr(p, 'is_zoomed') else p.get('is_zoomed', False),
                    'narration': getattr(p, 'narration', None) if hasattr(p, 'narration') else p.get('narration'),
                    'audio_data': getattr(p, 'audio_data', None) if hasattr(p, 'audio_data') else p.get('audio_data')
                }
                for p in panels_data
            ]
        except Exception as conv_err:
            logger.error(f"Error converting panel data to dicts: {conv_err}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Invalid panels data: {conv_err}")

        logger.debug(f"Prepared panels_payload count: {len(panels_payload)}")
        if panels_payload:
            logger.debug(f"First panel keys: {list(panels_payload[0].keys())}")
            logger.debug(f"First panel has narration: {bool(panels_payload[0].get('narration'))}")
            logger.debug(f"First panel has audio_data: {bool(panels_payload[0].get('audio_data'))}")
            if panels_payload[0].get('audio_data'):
                logger.debug(f"First panel audio_data length: {len(panels_payload[0]['audio_data'])}")

        # Use the authenticated user's ID
        user_id = current_user.get('id')

        # Get thumbnail data if provided
        thumbnail_data = raw_data.get('thumbnail_data')

        return await comic_storage_service.save_comic(user_id, comic_title, panels_payload, thumbnail_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving comic: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-comics")
async def get_user_comics(current_user: dict = Depends(get_current_user)):
    """
    Get all comics for the authenticated user from Supabase
    """
    try:
        user_id = current_user.get('id')
        logger.info(f"Fetching comics for user: {user_id}")
        
        # Use the ComicStorageService to get user comics
        comics = await comic_storage_service.get_user_comics(user_id)
        
        logger.info(f"Found {len(comics)} comics for user {user_id}")
        return {'comics': comics}
        
    except Exception as e:
        logger.error(f"Error fetching user comics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/public-comics")
async def get_public_comics():
    """
    Get all public comics from all users for the explore page
    """
    try:
        logger.info("Fetching public comics")
        
        # Use the ComicStorageService to get public comics
        comics = await comic_storage_service.get_public_comics()
        
        logger.info(f"Found {len(comics)} public comics")
        return {'comics': comics}
        
    except Exception as e:
        logger.error(f"Error fetching public comics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{comic_id}/visibility")
async def update_comic_visibility(comic_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """
    Update comic visibility (public/private)
    Requires authentication via JWT token
    """
    try:
        user_id = current_user.get('id')
        raw_data = await request.json()
        is_public = raw_data.get('is_public', False)

        logger.info(f"Updating comic {comic_id} visibility to {is_public} for user {user_id}")

        # If trying to make public, validate that comic is complete
        if is_public:
            # Get comic data to validate completeness
            comic_response = comic_storage_service.supabase.table('comics').select("""
                id, title, user_id, is_public, created_at, updated_at,
                comic_panels(id, panel_number, public_url, storage_path, file_size, created_at, narration, audio_url)
            """).eq('id', comic_id).eq('user_id', user_id).execute()
            
            if not comic_response.data:
                raise HTTPException(status_code=404, detail='Comic not found or unauthorized')
            
            comic_data = comic_response.data[0]
            panels = comic_data.get('comic_panels', [])
            
            # Validate comic completeness
            has_title = comic_data.get('title') and comic_data.get('title').strip()
            has_narrations = all(
                panel.get('narration') and panel.get('narration').strip() 
                for panel in panels 
                if panel.get('panel_number', 0) > 0  # Exclude panel 0 (thumbnail)
            )
            has_thumbnail = any(panel.get('panel_number') == 0 for panel in panels)
            
            if not has_title:
                raise HTTPException(status_code=400, detail='Cannot publish: Comic title is required')
            if not has_narrations:
                raise HTTPException(status_code=400, detail='Cannot publish: All panels must have narrations')
            if not has_thumbnail:
                raise HTTPException(status_code=400, detail='Cannot publish: Comic thumbnail is required')

        # Update comic visibility in database
        response = comic_storage_service.supabase.table('comics').update({
            'is_public': is_public
        }).eq('id', comic_id).eq('user_id', user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail='Comic not found or unauthorized')

        logger.info(f"Updated comic {comic_id} visibility to {is_public}")
        return {'success': True, 'is_public': is_public}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating comic visibility: {e}", exc_info=True)
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
                        logger.warning(f"Error reading panel 1 as cover for {comic_dir}: {e}")
                
                comics.append(comic_data)
        
        return {'comics': comics}

    except Exception as e:
        logger.error(f"Error listing comics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user-comics/{comic_id}")
async def delete_comic(comic_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific comic by ID"""
    try:
        logger.info(f"Deleting comic {comic_id} for user {current_user.get('email', 'Unknown')}")
        
        # Use the comic storage service to delete the comic
        success = await comic_storage_service.delete_comic(current_user.get('id'), comic_id)
        
        if success:
            logger.info(f"Successfully deleted comic {comic_id}")
            return {"success": True, "message": "Comic deleted successfully"}
        else:
            logger.warning(f"Failed to delete comic {comic_id}")
            raise HTTPException(status_code=404, detail="Comic not found or you don't have permission to delete it")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting comic: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))