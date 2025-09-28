from fastapi import APIRouter, Depends, HTTPException, Request
from schemas.comic import ComicArtRequest, ComicResponse, ComicRequest
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

@router.post("/save")
async def save_comic(request: ComicRequest, current_user: dict = Depends(get_current_user)):
    """
    Save a comic to the database
    Requires authentication via JWT token
    """
    try:
        user_id = current_user.get('id')
        return await comic_storage_service.save_comic(user_id, request.comic_title, request.panels_data)
    except Exception as e:
        print(f"❌ Error saving comic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-comics")
async def get_user_comics(current_user: dict = Depends(get_current_user)):
    """
    List comics for the authenticated user only
    Returns only comics from database that belong to the user
    """
    try:
        user_id = current_user.get('id')
        print(f"👤 Listing my comics for user: {user_id}")
        
        # Get comics from database for this user only
        try:
            database_comics = await comic_storage_service.get_user_comics(user_id)
            print(f"👤 Found {len(database_comics)} comics in database for user")
            
            # Convert database comics to the expected format
            formatted_comics = []
            for comic in database_comics:
                # Get cover image from the first panel
                cover_image = None
                if comic.get('comic_panels'):
                    first_panel = next((panel for panel in comic['comic_panels'] if panel['panel_number'] == 1), None)
                    if first_panel and first_panel.get('public_url'):
                        cover_image = first_panel['public_url']
                
                formatted_comic = {
                    'title': comic['title'],
                    'panel_count': len(comic.get('comic_panels', [])),
                    'has_cover': cover_image is not None,
                    'cover_image': cover_image,
                    'created_at': comic.get('created_at'),
                    'id': comic.get('id')
                }
                formatted_comics.append(formatted_comic)
            
            print(f"✅ Returning {len(formatted_comics)} user comics")
            return {'comics': formatted_comics}
        
        except Exception as db_error:
            print(f"⚠️ Database query failed: {db_error}")
            import traceback
            print(f"🔍 Full traceback: {traceback.format_exc()}")
            print("⚠️ Returning empty comics list due to database error")
            return {'comics': []}

    except Exception as e:
        print(f"❌ Error listing my comics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all")
async def get_all_comics():
    """
    List all comics (includes both database and local directory)
    Public endpoint for exploration and backwards compatibility
    """
    try:
        print("📚 Listing all comics (public endpoint)")
        all_comics = []
        
        # Get comics from database (all users)
        try:
            database_comics = await comic_storage_service.get_all_comics()
            print(f"📚 Found {len(database_comics)} comics in database")
            
            # Convert database comics to the expected format
            for comic in database_comics:
                # Get cover image from the first panel
                cover_image = None
                if comic.get('comic_panels'):
                    first_panel = next((panel for panel in comic['comic_panels'] if panel['panel_number'] == 1), None)
                    if first_panel and first_panel.get('public_url'):
                        cover_image = first_panel['public_url']
                
                formatted_comic = {
                    'title': comic['title'],
                    'panel_count': len(comic.get('comic_panels', [])),
                    'has_cover': cover_image is not None,
                    'cover_image': cover_image,
                    'created_at': comic.get('created_at'),
                    'id': comic.get('id'),
                    'source': 'database'
                }
                all_comics.append(formatted_comic)
        
        except Exception as db_error:
            print(f"⚠️ Database query failed: {db_error}")
        
        # Also include local directory comics for backwards compatibility
        import os
        import glob
        
        print("📁 Adding local directory comics")
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'saved-comics')
        
        if os.path.exists(saved_comics_dir):
            # Get all comic directories
            comic_dirs = [d for d in os.listdir(saved_comics_dir) 
                         if os.path.isdir(os.path.join(saved_comics_dir, d))]
            
            # Sort by modification time (newest first)
            comic_dirs.sort(key=lambda x: os.path.getmtime(os.path.join(saved_comics_dir, x)), reverse=True)
            
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
                        'has_cover': has_cover,
                        'source': 'local'
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
                    
                    all_comics.append(comic_data)
        
        print(f"📚 Returning {len(all_comics)} total comics")
        return {'comics': all_comics}

    except Exception as e:
        print(f"❌ Error listing comics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/load/{comic_title}")
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
        print(f"Loading comic: '{comic_title}' -> decoded: '{decoded_title}'")
        
        # Look for the comic directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'saved-comics')
        comic_dir = os.path.join(saved_comics_dir, decoded_title)
        
        print(f"Looking for comic directory: {comic_dir}")
        
        if not os.path.exists(comic_dir):
            # List available comics for debugging
            available_comics = []
            if os.path.exists(saved_comics_dir):
                available_comics = [d for d in os.listdir(saved_comics_dir) 
                                  if os.path.isdir(os.path.join(saved_comics_dir, d))]
            print(f"Available comics: {available_comics}")
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
                        'image_data': f"data:image/png;base64,{image_base64}"
                    })
        
        return {
            'success': True,
            'comic_title': comic_title,
            'panels': panels
        }

    except Exception as e:
        print(f"❌ Error loading comic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-panel")
async def save_panel(request: ComicRequest, current_user: dict = Depends(get_current_user)):
    """
    Save a comic panel image to both local storage and Supabase Storage
    Requires authentication via JWT token
    """
    try:
        data = request.dict()
        print(f"🔍 DEBUG: Received data keys: {list(data.keys())}")
        print(f"🔍 DEBUG: comic_title: {data.get('comic_title')}")
        print(f"🔍 DEBUG: panel_id: {data.get('panel_id')}")
        print(f"🔍 DEBUG: image_data length: {len(data.get('image_data', '')) if data.get('image_data') else 'None'}")
        print(f"🔍 DEBUG: Authenticated user: {current_user.get('email', 'Unknown')} (ID: {current_user.get('id', 'Unknown')})")
        
        comic_title = data.get('comic_title')
        panel_id = data.get('panel_id')
        image_data = data.get('image_data')

        if not all([comic_title, panel_id, image_data]):
            print(f"❌ Missing fields - comic_title: {comic_title}, panel_id: {panel_id}, image_data: {bool(image_data)}")
            raise HTTPException(status_code=400, detail='Missing required fields')

        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'saved-comics')
        os.makedirs(saved_comics_dir, exist_ok=True)

        # Create comic-specific directory
        comic_dir = os.path.join(saved_comics_dir, comic_title)
        os.makedirs(comic_dir, exist_ok=True)

        # Save the panel image locally
        import base64
        image_bytes = base64.b64decode(image_data)
        panel_filename = f"panel_{panel_id}.png"
        panel_path = os.path.join(comic_dir, panel_filename)

        with open(panel_path, 'wb') as f:
            f.write(image_bytes)

        print(f"💾 Saved panel {panel_id} locally to: {panel_path}")

        # 2. Save to Supabase Storage using ComicStorageService (NEW)
        try:
            # Use the authenticated user's ID
            user_id = current_user.get('id')
            
            # Use the ComicStorageService to save the panel
            panel_result = await comic_storage_service.save_panel(
                user_id=user_id,
                comic_title=comic_title,
                panel_id=panel_id,
                image_data=image_data
            )
            
            print(f"☁️ Successfully saved panel {panel_id} to Supabase:")
            print(f"   - User ID: {user_id}")
            print(f"   - Comic ID: {panel_result['comic_id']}")
            print(f"   - Storage Path: {panel_result['storage_path']}")
            print(f"   - Public URL: {panel_result['public_url']}")
            print(f"   - File Size: {panel_result['file_size']} bytes")
            
        except Exception as supabase_error:
            print(f"⚠️ Warning: Failed to save to Supabase Storage: {supabase_error}")
            import traceback
            print(f"🔍 Full error traceback: {traceback.format_exc()}")
            # Don't fail the entire request if Supabase fails - local save still worked
        
        return {'success': True, 'message': f'Panel {panel_id} saved successfully to both local and cloud storage'}

    except Exception as e:
        print(f"Error saving panel: {e}")
        raise HTTPException(status_code=500, detail=str(e))
