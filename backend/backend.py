import fastapi
from fastapi import UploadFile, File
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv
from dedalus_labs.utils.streaming import stream_async
import uvicorn
import base64
import PIL
from PIL import Image
from io import BytesIO

load_dotenv()

app = fastapi.FastAPI()

dedalus_client = AsyncDedalus()
dedalus_runner = DedalusRunner(dedalus_client)

latest_img: Image.Image = None

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


async def iterate_prompt_tool(user_feedback: str) -> str:
     # Prepare the payload for the Gemini API
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"The following is user feedback on the attached image: {user_feedback}. Please generate a single image prompt to generate a new image based on the feedback. Return only the image prompt, no other text. Make the prompt very detailed and specific. Avoid any information about the image pixel size."
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": image_to_base64
                            }
                        }
                    ]
                }
            ]
        }
        
        # Make the request to the Gemini API
        import os
        import httpx
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise fastapi.HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY environment variable not set"
            )
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                raise fastapi.HTTPException(
                    status_code=response.status_code,
                    detail=f"Gemini API error: {response.text}"
                )
            
            result = response.json()
            
            # Extract the generated text from the response
            try:
                generated_text = result["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as e:
                raise fastapi.HTTPException(
                    status_code=500,
                    detail=f"Error parsing Gemini API response: {e}"
                )
            
            return generated_text

#TODO: Image gen tool

#TODO: Dedalus runner with provided tools and a system prompt to be able to generate and iterate on images.

#landing page
@app.post("/initial-draw")
async def initial_draw(
    description_text: str,
    drawing_file: UploadFile = File(...),
):
    """
    Accepts an uploaded drawing and a text description, then uses the Gemini API
    to generate a textual understanding of the drawing in the context of the description.
    
    Args:
        drawing_file (UploadFile): The uploaded image file.
        description_text (str): A textual prompt or context for the image.
    
    Returns:
        dict: A JSON response containing the generated text description.
    """
    try:
        # Convert the uploaded file to a PIL Image
        image = await upload_file_to_image_obj(drawing_file)
        global latest_img
        latest_img = image
        # Convert the PIL Image to base64
        base64_image = image_to_base64(image)
        
        dedalus_runner.run(
            input="Your task is to refine an image based on the user's feedback. The user's feedback is: {description_text}. The ",
            model="openai/gpt-4o-mini",
            tools=[iterate_prompt_tool],
            stream=False
        )
        
        return {"description": generated_text}
            
    except Exception as e:
        raise fastapi.HTTPException(status_code=500, detail=str(e))


@app.post("/iterate-draw")
async def iterate_draw(
    user_feedback: str,
    drawing_file: UploadFile = File(...),
):
    """
    Accepts an uploaded drawing and a text description, then uses the dedalus agent
    to generate a textual understanding of the drawing in the context of the description.
    
    Args:
        drawing_file (UploadFile): The uploaded image file.
        description_text (str): The text description of the drawing.
    """
    global latest_img
    latest_img = await upload_file_to_image_obj(drawing_file)
    
    return {"description": generated_text}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)