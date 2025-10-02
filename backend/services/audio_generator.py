"""
Audio Generator using ElevenLabs Text-to-Speech API
Generates high-quality audio from text input
"""

import os
import base64
import httpx
import asyncio
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class AudioGenerator:
    """
    ElevenLabs Text-to-Speech Audio Generator
    
    This service converts text to speech using the ElevenLabs API,
    providing high-quality, natural-sounding voice synthesis.
    """
    
    def __init__(self):
        """Initialize the AudioGenerator with API configuration."""
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        self.base_url = "https://api.elevenlabs.io/v1"
        
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY environment variable is required")
        
        # Default voice settings - can be customized
        self.default_voice_settings = {
            "stability": 0.75,
            "similarity_boost": 0.9,
            "style": 0.5
        }
        
        # Default voice ID - you can change this to your preferred voice
        self.default_voice_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
        
    async def get_available_voices(self) -> Dict[str, Any]:
        """
        Retrieve list of available voices from ElevenLabs
        
        Returns:
            Dict containing voice information
        """
        url = f"{self.base_url}/voices"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error fetching voices: {e}", exc_info=True)
                raise
    
    async def generate_audio(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_multilingual_v2",
        voice_settings: Optional[Dict[str, Any]] = None,
        output_format: str = "mp3_44100_128"
    ) -> bytes:
        """
        Generate audio from text using ElevenLabs TTS API
        
        Args:
            text: The text to convert to speech
            voice_id: ID of the voice to use (defaults to default_voice_id)
            model_id: Model to use for synthesis
            voice_settings: Custom voice settings (stability, similarity_boost, etc.)
            output_format: Audio output format
            
        Returns:
            Audio data as bytes
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # Use default voice if none specified
        if not voice_id:
            voice_id = self.default_voice_id
            
        # Use default settings if none specified
        if not voice_settings:
            voice_settings = self.default_voice_settings
        
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_settings,
            "output_format": output_format
        }
        
        logger.info(f"Generating audio for text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        logger.debug(f"Using voice ID: {voice_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                
                audio_data = response.content
                logger.info(f"Audio generated successfully ({len(audio_data)} bytes)")
                return audio_data
                
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP Error {e.response.status_code}: {e.response.text}", exc_info=True)
                raise
            except httpx.TimeoutException:
                logger.error("Request timed out", exc_info=True)
                raise
            except Exception as e:
                logger.error(f"Unexpected error: {e}", exc_info=True)
                raise
    
    async def generate_audio_base64(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_multilingual_v2",
        voice_settings: Optional[Dict[str, Any]] = None,
        output_format: str = "mp3_44100_128"
    ) -> str:
        """
        Generate audio and return as base64 encoded string
        
        Args:
            text: The text to convert to speech
            voice_id: ID of the voice to use
            model_id: Model to use for synthesis
            voice_settings: Custom voice settings
            output_format: Audio output format
            
        Returns:
            Base64 encoded audio data
        """
        audio_data = await self.generate_audio(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            voice_settings=voice_settings,
            output_format=output_format
        )
        
        base64_audio = base64.b64encode(audio_data).decode('utf-8')
        logger.debug(f"Audio converted to base64 ({len(base64_audio)} characters)")
        return base64_audio
    
    async def save_audio_file(
        self,
        text: str,
        output_path: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_multilingual_v2",
        voice_settings: Optional[Dict[str, Any]] = None,
        output_format: str = "mp3_44100_128"
    ) -> str:
        """
        Generate audio and save to file
        
        Args:
            text: The text to convert to speech
            output_path: Path where to save the audio file
            voice_id: ID of the voice to use
            model_id: Model to use for synthesis
            voice_settings: Custom voice settings
            output_format: Audio output format
            
        Returns:
            Path to the saved audio file
        """
        audio_data = await self.generate_audio(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            voice_settings=voice_settings,
            output_format=output_format
        )
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'wb') as audio_file:
            audio_file.write(audio_data)
        
        logger.info(f"Audio saved to: {output_path}")
        return output_path
    
    def get_voice_presets(self) -> Dict[str, Dict[str, Any]]:
        """
        Get predefined voice setting presets for different use cases
        
        Returns:
            Dictionary of voice presets
        """
        return {
            "narrative": {
                "stability": 0.8,
                "similarity_boost": 0.8,
                "style": 0.3,
                "use_speaker_boost": True
            },
            "conversational": {
                "stability": 0.7,
                "similarity_boost": 0.9,
                "style": 0.6,
                "use_speaker_boost": True
            },
            "dramatic": {
                "stability": 0.6,
                "similarity_boost": 0.8,
                "style": 0.8,
                "use_speaker_boost": True
            },
            "calm": {
                "stability": 0.9,
                "similarity_boost": 0.7,
                "style": 0.2,
                "use_speaker_boost": False
            },
            "energetic": {
                "stability": 0.5,
                "similarity_boost": 0.9,
                "style": 0.9,
                "use_speaker_boost": True
            }
        }

# Global instance
audio_generator = AudioGenerator()

# Convenience functions for easy usage
async def generate_speech(text: str, voice_id: Optional[str] = None) -> bytes:
    """
    Quick function to generate speech from text
    
    Args:
        text: Text to convert to speech
        voice_id: Optional voice ID
        
    Returns:
        Audio data as bytes
    """
    return await audio_generator.generate_audio(text, voice_id)

async def generate_speech_base64(text: str, voice_id: Optional[str] = None) -> str:
    """
    Quick function to generate speech and return as base64
    
    Args:
        text: Text to convert to speech
        voice_id: Optional voice ID
        
    Returns:
        Base64 encoded audio data
    """
    return await audio_generator.generate_audio_base64(text, voice_id)

async def save_speech_file(text: str, output_path: str, voice_id: Optional[str] = None) -> str:
    """
    Quick function to generate speech and save to file
    
    Args:
        text: Text to convert to speech
        output_path: Where to save the file
        voice_id: Optional voice ID
        
    Returns:
        Path to saved file
    """
    return await audio_generator.save_audio_file(text, output_path, voice_id)

# Example usage
if __name__ == "__main__":
    async def test_audio_generation():
        """Test the audio generation functionality"""
        try:
            # Test basic text-to-speech
            test_text = "Hello! This is a test of the ElevenLabs text-to-speech integration for PixelPanel comics."
            
            logger.info("Testing audio generation...")
            
            # Generate audio and save to file
            output_path = "test_audio.mp3"
            saved_path = await save_speech_file(test_text, output_path)
            logger.info(f"Test audio saved to: {saved_path}")
            
            # Test base64 generation
            base64_audio = await generate_speech_base64(test_text)
            logger.info(f"Base64 audio generated ({len(base64_audio)} characters)")
            
            # Test with different voice settings
            dramatic_settings = audio_generator.get_voice_presets()["dramatic"]
            dramatic_audio = await audio_generator.generate_audio(
                text="This is a dramatic reading of your comic panel!",
                voice_settings=dramatic_settings
            )
            
            with open("dramatic_test.mp3", "wb") as f:
                f.write(dramatic_audio)
            logger.info("Dramatic voice test completed")
            
        except Exception as e:
            logger.error(f"Test failed: {e}", exc_info=True)
    
    # Run the test
    asyncio.run(test_audio_generation())