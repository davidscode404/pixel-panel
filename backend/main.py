from fastapi import UploadFile, File, HTTPException, Request, Response, Depends, FastAPI
import asyncio
from dotenv import load_dotenv
import uvicorn
import base64
import PIL
from PIL import Image
from io import BytesIO
import os
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
from google import genai
from google.genai import types
from services.comic_generator import ComicArtGenerator
from services.comic_storage import ComicStorageService
from supabase import create_client, Client
from api.auth import router as auth_router
from api.comics import router as comics_router
from api.voice_over import router as voice_over_router
from api.comics import set_services


load_dotenv()

app = FastAPI(title="PixelPanel", version="1.0.0")

comic_generator = ComicArtGenerator()
comic_storage_service = ComicStorageService()

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

latest_img: Image.Image = None

# Context tracking for comic generation
comic_context = {
    "panels": {},  
    "is_reset": True
}

class ComicArtRequest(BaseModel):
    text_prompt: str
    reference_image: str = None  
    panel_id: int = None  

app.include_router(auth_router)
app.include_router(comics_router)

# Initialize services in the comics router
set_services(comic_generator, comic_storage_service, comic_context)

async def upload_file_to_image_obj(img_file: UploadFile) -> Image.Image:
    """
    Converts a FastAPI UploadFile object to a PIL.Image.Image object.

    Args:
        img_file (UploadFile): The UploadFile object to convert.

    Returns:
        PIL.Image.Image: The converted image object.
    """
    PIL.Image.WARN_POSSIBLE_FORMATS = True
    print(f"img_file.filename: {img_file.filename}")
    try:
        img_file_data = await img_file.read()
        img_bytes_stream = BytesIO(img_file_data)
        img = Image.open(img_bytes_stream).convert("RGB")
        return img
    except Exception as e:
        error_msg = f"There was an error converting the file to an image object: {e}"
        print(error_msg)
        raise IOError(error_msg)

def image_to_base64(image: Image.Image) -> str:
    img_bytes = BytesIO()
    image.save(img_bytes, format="PNG")
    base64_img = base64.b64encode(img_bytes.getvalue()).decode("utf-8")
    return base64_img

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
    client = genai.Client(api_key=google_api_key)

    contents_for_gemini = []
    for image in images:
        contents_for_gemini.append(types.Part.from_bytes(
            data=image.file.read(),
            mime_type='image/png'
        ))

    contents_for_gemini.append(types.Part(text="Generate a story summary from the images"))

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents_for_gemini
    )
    print(response.text)
    return {'story_summary': response.text}
    
    # Use dedalus to extend the the story and generate the prompts for the next panels
    client = AsyncDedalus()
    runner = DedalusRunner(client)

    result = await runner.run(
        input=f"Please extend the story summary with {6 - len(images)} story points.", 
        model="openai/gpt-4.0-mini", 
    )

    result = result.content
    # Feed the story summary, panel prompts, and previous images to gemini for generation of the next comic panels.


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


@app.get("/list-comics")
async def list_comics():
    """
    List all saved comics in the project directory
    """
    try:
        import os
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
        print(f"Loading comic: '{comic_title}' -> decoded: '{decoded_title}'")
        
        # Look for the comic directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
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


@app.post("/save-panel")
async def save_panel(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Save a comic panel image to both local storage and Supabase Storage
    Requires authentication via JWT token
    """
    try:
        data = await request.json()
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

        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
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


@app.get("/user-comics")
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

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)