# backend/api/comics.py
from fastapi import APIRouter, Depends, HTTPException, Request
from schemas.comic import ComicArtRequest, ComicResponse, ComicRequest
from services.comic_storage import ComicStorageService
from services.comic_generator import ComicArtGenerator
import json
import httpx
import os
from supabase import create_client, Client

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
        import traceback
        print(f"📋 Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))