from fastapi import APIRouter, HTTPException, Response
from services.audio_generator import AudioGenerator
import openai
from dotenv import load_dotenv

load_dotenv()
AudioGenerator()

router = APIRouter(prefix="/api/voice-over")
