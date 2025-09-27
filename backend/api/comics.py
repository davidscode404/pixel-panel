# backend/api/comics.py
from fastapi import APIRouter, Depends, HTTPException, Request
from schemas.comic import ComicArtRequest, ComicResponse, ComicRequest
from services.comic_storage import ComicStorageService
from services.comic_generator import ComicArtGenerator
import json
import httpx
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import base64

load_dotenv()

router = APIRouter(prefix="/api/comics", tags=["comics"])

# Initialize Supabase client for auth
supabase_url = os.getenv('SUPABASE_URL')
supabase_anon_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_anon_key)

async def get_current_user(request: Request) -> dict:
    """
    Extract and validate JWT token from Authorization header
    Returns the user data if valid, raises HTTPException if invalid
    """
    try:
        # Get the Authorization header
        auth_header = request.headers.get("Authorization")
        print(f"🔍 DEBUG: Auth header: {auth_header}")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            print("❌ Missing or invalid Authorization header")
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authorization header"
            )
        
        # Extract the token
        token = auth_header.split(" ")[1]
        print(f"🔍 DEBUG: Token length: {len(token)}")
        print(f"🔍 DEBUG: Token starts with: {token[:50]}...")
        
        # Check if token has proper JWT structure (3 parts separated by dots)
        token_parts = token.split('.')
        print(f"🔍 DEBUG: Token parts count: {len(token_parts)}")
        
        # Verify the JWT token with Supabase Auth server
        try:
            # Use the auth server to verify the token
            async with httpx.AsyncClient() as client:
                auth_response = await client.get(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": supabase_anon_key
                    }
                )
                
                if auth_response.status_code != 200:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired token"
                    )
                
                user_data = auth_response.json()
                return {
                    "id": user_data.get("id"),
                    "email": user_data.get("email"),
                    "user_metadata": user_data.get("user_metadata", {})
                }
                
        except httpx.HTTPError as e:
            print(f"JWT verification HTTP error: {e}")
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )
        except Exception as e:
            print(f"JWT verification error: {e}")
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )

# These will be set by main.py to avoid circular imports
comic_generator = None
comic_storage_service = None

def set_services(generator, storage):
    """Set services from main.py to avoid circular imports"""
    global comic_generator, comic_storage_service
    comic_generator = generator
    comic_storage_service = storage

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
        previous_panel_context = request.previous_panel_context
        
        print(f"🔍 DEBUG: panel_id={panel_id}, has_previous_context={previous_panel_context is not None}")
        
        # Use previous panel context if provided by frontend
        context_image_data = None
        
        if previous_panel_context:
            # Use the previous panel's prompt and image as context
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
                }
                for p in panels_data
            ]
        except Exception as conv_err:
            print(f"❌ Error converting PanelData to dicts: {conv_err}")
            raise HTTPException(status_code=400, detail=f"Invalid panels data: {conv_err}")

        print(f"🔍 DEBUG: Prepared panels_payload count: {len(panels_payload)}")
        if panels_payload:
            print(f"🔍 DEBUG: First panel keys: {list(panels_payload[0].keys())}")

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
