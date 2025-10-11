from fastapi import APIRouter, Body, Depends, HTTPException, Request
from services.audio_generator import AudioGenerator
from services.user_credits import UserCreditsService
from auth_shared import get_current_user
from slowapi import Limiter
from slowapi.util import get_remote_address
import google.generativeai as genai
import os
import json
import logging

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Google Generative AI
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in environment variables")

genai.configure(api_key=api_key)
audio_generator = AudioGenerator()
credits_service = UserCreditsService()

router = APIRouter(prefix="/api/voice-over")
limiter = Limiter(key_func=get_remote_address)

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
        logger.info(f"Generated story ({len(story_content)} chars): {story_content[:100]}..." if len(story_content) > 100 else f"Generated story: {story_content}")

        if story_content.startswith("```json"):
            story_content = story_content.replace("```json", "").replace("```", "").strip()

        try:
            json.loads(story_content)
            return story_content
        except json.JSONDecodeError:
            json_response = json.dumps({"story": story_content})
            return json_response

    except Exception as e:
        logger.error(f"Error generating story: {e}", exc_info=True)
        fallback_response = json.dumps({
            "story": f"Once upon a time, there was a story about: {story}",
            "error": "Failed to generate custom story"
        })
        return fallback_response

@router.post("/generate-story")
@limiter.limit("20/minute")
async def generate_story_endpoint(request: Request, story: str = Body(..., embed=True)):
    """
    Generate story endpoint
    """
    result = await generate_story(story)

    # Parse the result to ensure it's valid JSON
    try:
        parsed_result = json.loads(result)
        logger.debug(f"Parsed story result: {parsed_result}")
        return parsed_result
    except json.JSONDecodeError:
        logger.debug(f"JSON decode error, returning as story: {result}")
        return {"story": result}

@router.get("/test-voice")
async def test_voice_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Test voice generation with default settings
    """
    try:
        test_text = "Hello! This is a test of the voice generation system."
        logger.info(f"Testing voice generation for user {current_user['id']}...")
        
        audio_data = await audio_generator.generate_audio_base64(test_text)
        
        return {
            "success": True,
            "message": "Voice generation test successful",
            "voice_id": audio_generator.default_voice_id,
            "audio_length": len(audio_data),
            "test_text": test_text
        }
    except Exception as e:
        logger.error(f"Voice test failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "voice_id": audio_generator.default_voice_id
        }

@router.post("/generate-voiceover")
@limiter.limit("10/minute")
async def generate_narration(
    request: Request, 
    narration: str = Body(...), 
    voice_id: str = Body(None),
    speed: float = Body(1.0),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate voice narration with optional voice selection and speed control
    """
    try:
        # Validate input
        if not narration or not narration.strip():
            raise HTTPException(
                status_code=400,
                detail="Narration text cannot be empty"
            )
        
        # Validate speed range (ElevenLabs supports 0.7 to 1.2)
        if speed < 0.7 or speed > 1.2:
            raise HTTPException(
                status_code=400,
                detail="Speed must be between 0.7 and 1.2"
            )
        
        # Check if user has sufficient credits (1 credit per narration)
        if not await credits_service.has_sufficient_credits(current_user["id"], 1):
            raise HTTPException(
                status_code=402, 
                detail="Insufficient credits. Please purchase more credits to generate voice narrations."
            )
        
        # Adjust voice settings based on speed
        adjusted_settings = {
            "stability": max(0.1, min(0.95, 0.75 - (speed - 1.0) * 0.2)),
            "similarity_boost": 0.9,
            "style": 0.5
        }
        
        audio_data = await audio_generator.generate_audio_base64(
            narration, 
            voice_id=voice_id,
            voice_settings=adjusted_settings
        )
        
        # Deduct 1 credit after successful generation
        try:
            await credits_service.deduct_credits(current_user["id"], 1)
        except Exception as credit_error:
            logger.error(f"Failed to deduct credits: {credit_error}")
        
        return {"audio": audio_data}
    except HTTPException:
        raise
    except ValueError as e:
        # Handle validation errors from audio generator
        logger.error(f"Validation error generating voiceover: {e}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating voiceover: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate voiceover: {str(e)}"
        )
