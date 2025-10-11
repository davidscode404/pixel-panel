# backend/api/comics.py
from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from schemas.comic import ComicArtRequest, ComicRequest, ThumbnailRequest
from services.comic_storage import ComicStorageService
from services.comic_generator import ComicArtGenerator
from services.user_credits import UserCreditsService
from services.audio_generator import audio_generator
from auth_shared import get_current_user
from slowapi import Limiter
from slowapi.util import get_remote_address
import json
import base64
import os
import logging
from PIL import Image
import httpx
import io

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/comics", tags=["comics"])
limiter = Limiter(key_func=get_remote_address)

comic_generator = ComicArtGenerator()
comic_storage_service = ComicStorageService()
credits_service = UserCreditsService()

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_comic_art(request: Request, comic_request: ComicArtRequest, current_user: dict = Depends(get_current_user)):
    """
    Generate comic art from text prompt and optional reference image
    """
    try:
        # Check if user has sufficient credits (10 credits per panel)
        if not await credits_service.has_sufficient_credits(current_user["id"], 10):
            raise HTTPException(
                status_code=402, 
                detail="Insufficient credits. Please purchase more credits to generate comic panels."
            )
        text_prompt = comic_request.text_prompt
        reference_image_data = comic_request.reference_image
        panel_id = comic_request.panel_id
        previous_panel_context = comic_request.previous_panel_context
        
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
        
        # Deduct 10 credits after successful generation (multiplied by 10)
        try:
            new_balance = await credits_service.deduct_credits(current_user["id"], 10)
            logger.info(f"Deducted 10 credits from user {current_user['id']}. New balance: {new_balance}")
        except Exception as credit_error:
            logger.error(f"Failed to deduct credits for user {current_user['id']}: {credit_error}")
            # Note: We still return the generated image even if credit deduction fails
            # The credit can be deducted manually if needed
        
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
@limiter.limit("10/minute")
async def generate_thumbnail(request: Request, thumbnail_request: ThumbnailRequest, current_user: dict = Depends(get_current_user)):
    """
    Generate a thumbnail image based on comic prompts
    Returns a 3:4 aspect ratio image suitable for comic book covers
    """
    try:
        # Check if user has sufficient credits (10 credits per thumbnail)
        if not await credits_service.has_sufficient_credits(current_user["id"], 10):
            raise HTTPException(
                status_code=402, 
                detail="Insufficient credits. Please purchase more credits to generate thumbnails."
            )
        # Combine all prompts into a single prompt for thumbnail generation
        combined_prompt = f"Comic book cover art featuring: {', '.join(thumbnail_request.prompts[:3])}"  # Use first 3 prompts
        logger.debug(f"Generating thumbnail with prompt: {combined_prompt}")

        # Generate comic art using the service
        if not comic_generator:
            raise HTTPException(
                status_code=500,
                detail="Comic art generator not initialized"
            )

        # Generate the thumbnail with portrait orientation
        image = comic_generator.generate_comic_art(combined_prompt, None, None, is_thumbnail=True)

        # Ensure it's exactly 600x800 (3:4 aspect ratio)
        target_width = 600
        target_height = 800
        if image.size != (target_width, target_height):
            image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)

        # Convert image to base64 for response
        img_base64 = comic_generator.image_to_base64(image)

        # Deduct 10 credits after successful generation (multiplied by 10)
        try:
            new_balance = await credits_service.deduct_credits(current_user["id"], 10)
            logger.info(f"Deducted 10 credits from user {current_user['id']} for thumbnail. New balance: {new_balance}")
        except Exception as credit_error:
            logger.error(f"Failed to deduct credits for user {current_user['id']}: {credit_error}")
            # Note: We still return the generated thumbnail even if credit deduction fails

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
@limiter.limit("30/minute")
async def save_comic(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Save a comic to the database
    Requires authentication via JWT token
    """
    try:
        # First, let's see the raw request data
        raw_data = await request.json()
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

        # Get thumbnail data and visibility setting if provided
        thumbnail_data = raw_data.get('thumbnail_data')
        is_public = raw_data.get('is_public', False)
        
        logger.info(f"Saving comic with is_public={is_public}")

        # DISABLED: Auto-generate audio for panels that have narration but no audio_data
        # This feature has been disabled - users must manually generate voices before publishing
        # panels_with_audio = []
        # audio_generation_count = 0
        # 
        # for panel in panels_payload:
        #     narration = panel.get('narration')
        #     audio_data = panel.get('audio_data')
        #     
        #     # If panel has narration but no audio, generate it
        #     if narration and narration.strip() and not audio_data:
        #         try:
        #             logger.info(f"Auto-generating audio for panel {panel['id']} with narration: '{narration[:50]}...'")
        #             
        #             # Check if user has sufficient credits (minimum 6 credits required for auto audio)
        #             if not await credits_service.has_sufficient_credits(user_id, 6):
        #                 logger.warning(f"Insufficient credits for auto audio generation for panel {panel['id']}")
        #                 # Continue without audio generation
        #                 panels_with_audio.append(panel)
        #                 continue
        #             
        #             # Generate audio using the audio generator
        #             generated_audio = await audio_generator.generate_audio_base64(narration)
        #             
        #             # Update panel with generated audio
        #             panel['audio_data'] = generated_audio
        #             audio_generation_count += 1
        #             
        #             # Deduct 1 credit for audio generation
        #             try:
        #                 new_balance = await credits_service.deduct_credits(user_id, 1)
        #                 logger.info(f"Auto-generated audio for panel {panel['id']}. Deducted 1 credit. New balance: {new_balance}")
        #             except Exception as credit_error:
        #                 logger.error(f"Failed to deduct credits for auto audio generation: {credit_error}")
        #                 # Continue even if credit deduction fails
        #             
        #         except Exception as audio_error:
        #             logger.error(f"Failed to auto-generate audio for panel {panel['id']}: {audio_error}", exc_info=True)
        #             # Continue without audio generation
        #         
        #     panels_with_audio.append(panel)
        # 
        # if audio_generation_count > 0:
        #     logger.info(f"Auto-generated audio for {audio_generation_count} panels during comic publishing")

        return await comic_storage_service.save_comic(user_id, comic_title, panels_payload, thumbnail_data, is_public)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving comic: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/panels/{panel_id}/regenerate")
@limiter.limit("10/minute")
async def regenerate_panel_image(request: Request, panel_id: str, current_user: dict = Depends(get_current_user)):
    """
    Regenerate a panel's image with a new prompt while maintaining context
    """
    try:
        logger.info(f"Regenerating image for panel {panel_id} for user {current_user.get('id')}")
        raw_data = await request.json()
        text_prompt = raw_data.get('text_prompt')
        previous_panel_context = raw_data.get('previous_panel_context')
        
        if not text_prompt:
            raise HTTPException(status_code=422, detail="Missing required field: text_prompt")
        
        # Check if user has sufficient credits (10 credits per panel)
        if not await credits_service.has_sufficient_credits(current_user["id"], 10):
            raise HTTPException(
                status_code=402, 
                detail="Insufficient credits. Please purchase more credits to generate comic panels."
            )
        
        # Verify the panel exists and belongs to the user
        user_id = current_user.get('id')
        panel_check = comic_storage_service.supabase.table('comic_panels').select('id, comic_id, panel_number').eq('id', panel_id).execute()
        
        if not panel_check.data:
            raise HTTPException(status_code=404, detail="Panel not found")
        
        panel_data = panel_check.data[0]
        comic_id = panel_data['comic_id']
        panel_number = panel_data['panel_number']
        
        # Check if the comic belongs to the user
        comic_check = comic_storage_service.supabase.table('comics').select('id').eq('id', comic_id).eq('user_id', user_id).execute()
        
        if not comic_check.data:
            raise HTTPException(status_code=403, detail="You don't have permission to edit this panel")
        
        # Prepare context prompt if previous panel context is provided or infer it automatically
        context_image_data = None
        if previous_panel_context:
            # Accept either base64 or URL for image_data
            context_prompt_value = previous_panel_context.get('prompt')
            raw_context_image = previous_panel_context.get('image_data')

            # If the context image looks like a URL, fetch and base64-encode it
            if isinstance(raw_context_image, str) and raw_context_image.startswith('http'):
                try:
                    async with httpx.AsyncClient(timeout=20) as client:
                        resp = await client.get(raw_context_image)
                        resp.raise_for_status()
                        context_image_data = base64.b64encode(resp.content).decode('utf-8')
                        logger.info("Fetched context image from URL for regeneration")
                except Exception as fetch_err:
                    logger.warning(f"Failed to fetch context image from URL: {fetch_err}")
                    context_image_data = None
            else:
                context_image_data = raw_context_image

            text_prompt = f"Create the next scene using this context: {context_prompt_value}. {text_prompt}"
            logger.info("Using provided previous panel context for panel regeneration")
        else:
            # Infer context automatically from DB if not provided
            try:
                # For panel 1 use thumbnail (panel 0); otherwise use (panel_number - 1)
                prev_number = 0 if panel_number == 1 else (panel_number - 1)
                prev_panel_resp = comic_storage_service.supabase.table('comic_panels') \
                    .select('public_url,prompt,panel_number') \
                    .eq('comic_id', comic_id).eq('panel_number', prev_number).execute()
                if prev_panel_resp.data:
                    prev = prev_panel_resp.data[0]
                    prev_url = prev.get('public_url')
                    prev_prompt = prev.get('prompt')
                    if prev_url:
                        async with httpx.AsyncClient(timeout=20) as client:
                            resp = await client.get(prev_url)
                            resp.raise_for_status()
                            context_image_data = base64.b64encode(resp.content).decode('utf-8')
                            logger.info(f"Auto-fetched context image from panel {prev_number}")
                    if prev_prompt:
                        text_prompt = f"Create the next scene using this context: {prev_prompt}. {text_prompt}"
                else:
                    logger.info("No previous panel found for context; proceeding without context")
            except Exception as infer_err:
                logger.warning(f"Failed to infer previous panel context: {infer_err}")
        
        # Generate the new image
        image = comic_generator.generate_comic_art(text_prompt, None, context_image_data)
        
        # Convert to base64 for storage
        img_base64 = comic_generator.image_to_base64(image)
        
        # Upload the image to Supabase storage
        try:
            img_bytes = base64.b64decode(img_base64)
            file_path = f"users/{user_id}/comics/{comic_id}/panels/panel_{panel_number}_regenerated_{os.urandom(4).hex()}.png"
            
            upload_result = comic_storage_service.supabase.storage.from_('PixelPanel').upload(
                file_path,
                img_bytes,
                {'content-type': 'image/png', 'upsert': 'true'}
            )
            
            # Get public URL
            public_url = comic_storage_service.supabase.storage.from_('PixelPanel').get_public_url(file_path)
            
            # Update the panel in the database with new image URL and prompt
            update_result = comic_storage_service.supabase.table('comic_panels').update({
                'public_url': public_url,
                'prompt': text_prompt
            }).eq('id', panel_id).execute()
            
            if not update_result.data:
                raise HTTPException(status_code=500, detail="Failed to update panel")
            
            # Deduct 1 credit after successful generation
            try:
                new_balance = await credits_service.deduct_credits(user_id, 1)
                logger.info(f"Deducted 1 credit from user {user_id}. New balance: {new_balance}")
            except Exception as credit_error:
                logger.error(f"Failed to deduct credits for user {user_id}: {credit_error}")
            
            logger.info(f"Successfully regenerated panel {panel_id} with new image URL: {public_url}")
            
            return {
                "success": True,
                "public_url": public_url,
                "message": "Panel image regenerated successfully"
            }
            
        except Exception as storage_error:
            logger.error(f"Error uploading regenerated image: {storage_error}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(storage_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating panel {panel_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/panels/{panel_id}")
@limiter.limit("30/minute")
async def update_panel(request: Request, panel_id: str, current_user: dict = Depends(get_current_user)):
    """
    Update a specific panel's narration and/or prompt with optional voice customization
    """
    try:
        logger.info(f"Updating panel {panel_id} for user {current_user.get('id')}")
        raw_data = await request.json()
        logger.info(f"Request data: {raw_data}")
        narration = raw_data.get('narration')
        prompt = raw_data.get('prompt')
        voice_id = raw_data.get('voice_id')
        speed = raw_data.get('speed', 1.0)
        regenerate_audio = raw_data.get('regenerate_audio', False)
        
        if narration is None and prompt is None:
            raise HTTPException(status_code=422, detail="Missing required field: narration or prompt")
        
        # Prepare update data
        update_data = {}
        if narration is not None:
            update_data['narration'] = narration
        if prompt is not None:
            update_data['prompt'] = prompt
        
        logger.info(f"Update data: {update_data}")
        
        # First, verify the panel exists and belongs to the user
        user_id = current_user.get('id')
        panel_check = comic_storage_service.supabase.table('comic_panels').select('id, comic_id, panel_number').eq('id', panel_id).execute()
        
        if not panel_check.data:
            raise HTTPException(status_code=404, detail="Panel not found")
        
        # Check if the comic belongs to the user
        comic_check = comic_storage_service.supabase.table('comics').select('id').eq('id', panel_check.data[0]['comic_id']).eq('user_id', user_id).execute()
        
        if not comic_check.data:
            raise HTTPException(status_code=403, detail="You don't have permission to edit this panel")
        
        # If narration provided AND regenerate_audio is True, (re)generate audio and upload; then update audio_url
        audio_url = None
        if regenerate_audio and narration is not None and isinstance(narration, str) and narration.strip():
            # Check if user has sufficient credits (1 credit per narration)
            if not await credits_service.has_sufficient_credits(user_id, 1):
                raise HTTPException(
                    status_code=402, 
                    detail="Insufficient credits. Please purchase more credits to generate voice narrations."
                )
            try:
                logger.info(f"Generating updated audio for panel {panel_id}")
                
                # Adjust voice settings based on speed
                adjusted_settings = {
                    "stability": max(0.1, min(0.95, 0.75 - (speed - 1.0) * 0.2)),
                    "similarity_boost": 0.9,
                    "style": 0.5
                }
                
                # Generate audio base64 with optional voice_id and speed
                audio_b64 = await audio_generator.generate_audio_base64(
                    narration,
                    voice_id=voice_id,
                    voice_settings=adjusted_settings
                )
                
                # Upload to storage with upsert
                audio_storage_path = f"users/{user_id}/comics/{panel_check.data[0]['comic_id']}/audio/panel_{panel_check.data[0]['panel_number']}.mp3"
                audio_bytes = base64.b64decode(audio_b64)
                comic_storage_service.supabase.storage.from_('PixelPanel').upload(
                    path=audio_storage_path,
                    file=audio_bytes,
                    file_options={"content-type": "audio/mpeg", "upsert": "true"}
                )
                audio_url = comic_storage_service.supabase.storage.from_('PixelPanel').get_public_url(audio_storage_path)
                update_data['audio_url'] = audio_url
                # Deduct 1 credit upon successful generation
                try:
                    await credits_service.deduct_credits(user_id, 1)
                except Exception as credit_error:
                    logger.error(f"Failed to deduct credits for updated narration audio: {credit_error}")
            except Exception as audio_err:
                logger.error(f"Failed to generate/upload updated audio for panel {panel_id}: {audio_err}", exc_info=True)

        # Update the panel in the database
        result = comic_storage_service.supabase.table('comic_panels').update(update_data).eq('id', panel_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update panel")
        
        logger.info(f"Updated panel {panel_id} for user {user_id}: {list(update_data.keys())}")
        return {"success": True, "message": "Panel updated successfully", "audio_url": audio_url}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating panel {panel_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-comics")
@limiter.limit("50/minute")
async def get_user_comics(request: Request, current_user: dict = Depends(get_current_user)):
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
@limiter.limit("50/minute")
async def get_public_comics(request: Request):
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
@limiter.limit("30/minute")
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
@limiter.limit("50/minute")
async def list_comics(request: Request):
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
@limiter.limit("30/minute")
async def delete_comic(comic_id: str, request: Request, current_user: dict = Depends(get_current_user)):
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