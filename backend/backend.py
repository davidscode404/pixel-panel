import fastapi
from fastapi import UploadFile, File, HTTPException
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


# async def iterate_prompt_tool(user_feedback: str) -> str:
#     """
#     Generate a new image prompt based on user feedback using Gemini API.

#     Args:
#         user_feedback (str): User feedback on the current image

#     Returns:
#         str: Generated image prompt
#     """
#     # Prepare the payload for the Gemini API
#     payload = {
#         "contents": [
#             {
#                 "parts": [
#                     {
#                         "text": f"The following is user feedback on the attached image: {user_feedback}. Please generate a single image prompt to generate a new image based on the feedback. Return only the image prompt, no other text. Make the prompt very detailed and specific. Avoid any information about the image pixel size."
#                     },
#                     {
#                         "inline_data": {
#                             "mime_type": "image/png",
#                             "data": image_to_base64(latest_img) if latest_img else ""
#                         }
#                     }
#                 ]
#             }
#         ]
#     }

#     # Make the request to the Gemini API
#     api_key = os.getenv("GEMINI_API_KEY")
#     if not api_key:
#         raise HTTPException(
#             status_code=500,
#             detail="GEMINI_API_KEY environment variable not set"
#         )

#     url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

#     async with httpx.AsyncClient() as client:
#         response = await client.post(
#             url,
#             json=payload,
#             headers={"Content-Type": "application/json"}
#         )

#         if response.status_code != 200:
#             raise HTTPException(
#                 status_code=response.status_code,
#                 detail=f"Gemini API error: {response.text}"
#             )

#         result = response.json()

#         # Extract the generated text from the response
#         try:
#             generated_text = result["candidates"][0]["content"]["parts"][0]["text"]
#         except (KeyError, IndexError) as e:
#             raise HTTPException(
#                 status_code=500,
#                 detail=f"Error parsing Gemini API response: {e}"
#             )

#         return generated_text

# def process_base64_image(base64_data: str) -> str:
#     """
#     Process base64 image data and save to temporary file.

#     Args:
#         base64_data (str): Base64 encoded image data

#     Returns:
#         str: Path to temporary image file, None if processing fails
#     """
#     try:
#         # Decode base64 image
#         image_data = base64.b64decode(base64_data)

#         # Create temporary file for processing (will be cleaned up)
#         with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
#             temp_file.write(image_data)
#             temp_file_path = temp_file.name

#         print(f"Processing reference image in memory...")
#         return temp_file_path

#     except Exception as e:
#         print(f"Error processing reference image: {e}")
#         return None

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


# #landing page
# @app.post("/initial-draw")
# async def initial_draw(
#     description_text: str,
#     drawing_file: UploadFile = File(...),
# ):
#     """
#     Accepts an uploaded drawing and a text description, then uses the Gemini API
#     to generate a textual understanding of the drawing in the context of the description.

#     Args:
#         drawing_file (UploadFile): The uploaded image file.
#         description_text (str): A textual prompt or context for the image.

#     Returns:
#         dict: A JSON response containing the generated text description.
#     """
#     try:
#         # Convert the uploaded file to a PIL Image
#         image = await upload_file_to_image_obj(drawing_file)
#         global latest_img
#         latest_img = image

#         # Generate initial image prompt based on the drawing and description
#         generated_text = await iterate_prompt_tool(description_text)

#         return {"description": generated_text}

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/iterate-draw")
# async def iterate_draw(
#     user_feedback: str,
#     drawing_file: UploadFile = File(...),
# ):
#     """
#     Accepts an uploaded drawing and user feedback, then uses the Gemini API
#     to generate a new image prompt based on the feedback.

#     Args:
#         drawing_file (UploadFile): The uploaded image file.
#         user_feedback (str): User feedback on the current image.
#     """
#     global latest_img
#     latest_img = await upload_file_to_image_obj(drawing_file)

#     # Generate new image prompt based on user feedback
#     generated_text = await iterate_prompt_tool(user_feedback)

#     return {"description": generated_text}


@app.post("/generate-voiceover")
async def generate_voiceover(
    voiceover_text: str,
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
        "model_id": "eleven_multilingual_v2"
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
  

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)