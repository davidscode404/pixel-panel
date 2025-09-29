#!/usr/bin/env python3
"""
Test script for the Audio Generator service
Run this to test ElevenLabs integration
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to the path so we can import services
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from services.audio_generator import audio_generator, generate_speech_base64, save_speech_file

async def main():
    """Test the audio generation functionality"""
    print("🎵 Testing ElevenLabs Audio Generator")
    print("=" * 50)
    
    # Check if API key is set
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("❌ ELEVENLABS_API_KEY environment variable not set!")
        print("Please add your ElevenLabs API key to your .env file:")
        print("ELEVENLABS_API_KEY=your_api_key_here")
        return
    
    print(f"✅ API Key found: {api_key[:10]}...")
    
    try:
        # Test 1: Get available voices
        print("\n📋 Fetching available voices...")
        voices = await audio_generator.get_available_voices()
        print(f"✅ Found {len(voices.get('voices', []))} voices")
        
        # Show first few voices
        for i, voice in enumerate(voices.get('voices', [])[:3]):
            print(f"  - {voice.get('name', 'Unknown')}: {voice.get('voice_id', 'No ID')}")
        
        # Test 2: Generate a short audio clip
        print("\n🎤 Generating test audio...")
        test_text = "Hello! This is a test of the PixelPanel audio generator using ElevenLabs."
        
        # Create test output directory
        test_dir = backend_dir / "test_audio_output"
        test_dir.mkdir(exist_ok=True)
        
        # Generate and save audio file
        output_file = test_dir / "test_speech.mp3"
        saved_path = await save_speech_file(test_text, str(output_file))
        print(f"✅ Audio saved to: {saved_path}")
        
        # Test 3: Generate base64 audio
        print("\n📦 Generating base64 audio...")
        base64_audio = await generate_speech_base64("This is a base64 test.")
        print(f"✅ Base64 audio generated ({len(base64_audio)} characters)")
        
        # Test 4: Test different voice presets
        print("\n🎭 Testing voice presets...")
        presets = audio_generator.get_voice_presets()
        
        for preset_name, settings in list(presets.items())[:2]:  # Test first 2 presets
            print(f"  Testing {preset_name} preset...")
            preset_audio = await audio_generator.generate_audio(
                text=f"This is the {preset_name} voice preset.",
                voice_settings=settings
            )
            
            preset_file = test_dir / f"test_{preset_name}.mp3"
            with open(preset_file, "wb") as f:
                f.write(preset_audio)
            print(f"  ✅ {preset_name} audio saved to: {preset_file}")
        
        print("\n🎉 All tests passed!")
        print(f"📁 Test files saved in: {test_dir}")
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

