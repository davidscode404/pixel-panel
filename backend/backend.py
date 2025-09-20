import fastapi
from fastapi import UploadFile, File, HTTPException, Request
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv
from dedalus_labs.utils.streaming import stream_async
import uvicorn
import base64
import PIL
from PIL import Image
from io import BytesIO
import os
import tempfile
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import sys
from google import genai
from google.genai import types
import json

load_dotenv()


app = fastapi.FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

dedalus_client = AsyncDedalus()
dedalus_runner = DedalusRunner(dedalus_client)

latest_img: Image.Image = None

# Pydantic models
class ComicArtRequest(BaseModel):
    text_prompt: str
    reference_image: str = None  # Base64 encoded image data (optional)

# Initialize the comic art generator
from comic_art_generator import ComicArtGenerator

try:
    comic_generator = ComicArtGenerator()
    print(" Comic Art Generator initialized successfully")
except Exception as e:
    print(f" Warning: Could not initialize Comic Art Generator: {e}")
    comic_generator = None

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


@app.post("/generate")
async def generate_comic_art(request: ComicArtRequest):
    """
    Generate comic art from text prompt and optional reference image

    Expected JSON payload:
    {
        "text_prompt": "string",
        "reference_image": "base64_encoded_image_data" (optional)
    }
    """
    try:
        # FastAPI automatically parses the JSON body into the Pydantic model
        text_prompt = request.text_prompt
        reference_image_data = request.reference_image
        
        # Process reference image in memory if provided
        reference_image_path = None
        if reference_image_data:
            try:
                # Decode base64 image
                image_data = base64.b64decode(reference_image_data)
                
                # Create temporary file for processing (will be cleaned up)
                with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
                    temp_file.write(image_data)
                    reference_image_path = temp_file.name
                
                print(f"Processing reference image in memory...")
                
            except Exception as e:
                print(f"Error processing reference image: {e}")
                reference_image_path = None
        
        # Generate comic art
        if not comic_generator:
            raise HTTPException(
                status_code=500,
                detail="Comic art generator not initialized"
            )
            
        image = comic_generator.generate_comic_art(text_prompt, reference_image_path)
        
        # Clean up temporary reference image file
        if reference_image_path and os.path.exists(reference_image_path):
            os.unlink(reference_image_path)
            print(f"Cleaned up temporary reference image file")
        
        # Convert image to base64 for response
        img_buffer = BytesIO()
        image.save(img_buffer, format='PNG')
        img_bytes = img_buffer.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        return {
            'success': True,
            'image_data': img_base64,
            'message': 'Comic art generated successfully'
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
                comics.append({
                    'title': comic_dir,
                    'panel_count': len(panel_files)
                })
        
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
async def save_panel(request: Request):
    """
    Save a comic panel image to the project directory
    """
    try:
        data = await request.json()
        comic_title = data.get('comic_title')
        panel_id = data.get('panel_id')
        image_data = data.get('image_data')

        if not all([comic_title, panel_id, image_data]):
            raise HTTPException(status_code=400, detail='Missing required fields')

        # Create saved-comics directory if it doesn't exist
        import os
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        os.makedirs(saved_comics_dir, exist_ok=True)

        # Create comic-specific directory
        comic_dir = os.path.join(saved_comics_dir, comic_title)
        os.makedirs(comic_dir, exist_ok=True)

        # Save the panel image
        import base64
        image_bytes = base64.b64decode(image_data)
        panel_filename = f"panel_{panel_id}.png"
        panel_path = os.path.join(comic_dir, panel_filename)

        with open(panel_path, 'wb') as f:
            f.write(image_bytes)

        print(f"💾 Saved panel {panel_id} to: {panel_path}")
        return {'success': True, 'message': f'Panel {panel_id} saved successfully'}

    except Exception as e:
        print(f"❌ Error saving panel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-voiceover")
async def generate_voiceover(
    voiceover_text: str,
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb"
):
    """
    Generate a voiceover for a given text prompt using ElevenLabs TTS.
    
    Args:
        voiceover_text (str): The text to convert to speech.
    
    Returns:
        dict: A JSON response containing the base64-encoded audio data.
    """
    from dotenv import load_dotenv
    from elevenlabs.play import play
    
    import os
    import httpx
    
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY environment variable not set"
        )
    
    url = "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb"
    params = {"output_format": "mp3_44100_128"}
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "text": voiceover_text,
        "model_id": "eleven_multilingual_v2",
        "voice_id": voice_id
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                params=params,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            audio_bytes = response.content


        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"ElevenLabs API error: {e.response.text}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error generating voiceover: {str(e)}"
            )
  
    return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=voiceover.mp3"
            }
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)