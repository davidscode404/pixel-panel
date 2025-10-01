from fastapi import APIRouter, Body
from services.audio_generator import AudioGenerator
import google.generativeai as genai
import os
import json

from dotenv import load_dotenv

load_dotenv()

# Configure Google Generative AI
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in environment variables")

genai.configure(api_key=api_key)
audio_generator = AudioGenerator()

router = APIRouter(prefix="/api/voice-over")

async def generate_story(story: str):
    """
    Generate story using Google Generative AI
    """
    prompt = f"""
    You are a storyteller. You are given prompts users used to generate a comic and you need to create a narration for it. Keep it short and fun.
    The prompts are: {story}

    Please respond with a JSON object containing the generated story narration.
    """

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)

        story_content = response.text
        print(f"✅ Generated story ({len(story_content)} chars): {story_content[:100]}..." if len(story_content) > 100 else f"✅ Generated story: {story_content}")

        if story_content.startswith("```json"):
            story_content = story_content.replace("```json", "").replace("```", "").strip()

        try:
            json.loads(story_content)
            return story_content
        except json.JSONDecodeError:
            json_response = json.dumps({"story": story_content})
            return json_response

    except Exception as e:
        print(f"Error generating story: {e}")
        fallback_response = json.dumps({
            "story": f"Once upon a time, there was a story about: {story}",
            "error": "Failed to generate custom story"
        })
        return fallback_response

@router.post("/generate-story")
async def generate_story_endpoint(story: str = Body(..., embed=True)):
    """
    Generate story endpoint
    """
    result = await generate_story(story)

    # Parse the result to ensure it's valid JSON
    try:
        parsed_result = json.loads(result)
        return parsed_result
    except json.JSONDecodeError:
        return {"story": result}

@router.post("/generate-voiceover")
async def generate_narration(narration: str):
    """
    Generate voice narration
    """
    try:
        print(f"🎤 Generating audio for narration ({len(narration)} chars)...")
        audio_data = await audio_generator.generate_audio_base64(narration)
        print(f"✅ Audio generated, base64 length: {len(audio_data)} chars")
        return {"audio": audio_data}
    except Exception as e:
        print(f"❌ Error generating voiceover: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "audio": None}
