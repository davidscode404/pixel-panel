"""
Comic Art Generator using Gemini 2.5 Flash
Generates comic art for panels based on reference sketches from users
"""

import os
import sys
import base64
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

class ComicArtGenerator:
    def __init__(self):
        """Initialize the Comic Art Generator"""
        self.api_key = os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables")
        
        self.client = genai.Client(api_key=self.api_key)
    
    def generate_comic_art(self, text_prompt, reference_image_path=None):
        """
        Generate comic art based on text prompt and optional reference sketch
        
        Args:
            text_prompt (str): Text description for the comic panel
            reference_image_path (str): Path to reference sketch image file (optional)
            
        Returns:
            PIL.Image: Generated comic art image
        """
        system_prompt = (
            "You are a comic art generator. You generate art for panels based on a reference sketch from the user. "
            "Create clean, professional comic book style artwork that matches the reference sketch's composition and elements. "
            "Use bold lines, clear forms, and comic book aesthetics. Maintain the same perspective, character positions, "
            "and scene composition as shown in the reference sketch."
        )
        
        if reference_image_path:
            # Load image from file
            try:
                reference_image = Image.open(reference_image_path)
                print(f"📸 Loaded reference image: {reference_image.size} pixels")
                
                # Convert to bytes for API
                img_buffer = BytesIO()
                reference_image.save(img_buffer, format='PNG')
                img_bytes = img_buffer.getvalue()
                print(f"📦 Reference image size: {len(img_bytes)} bytes")
                
                # Create multimodal content with image and text
                contents = [
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="image/png",
                            data=img_bytes
                        )
                    ),
                    types.Part(
                        text=f"{system_prompt}\n\nText prompt: {text_prompt}"
                    )
                ]
                
                print("🔄 Generating comic art with reference sketch...")
                
            except Exception as e:
                raise Exception(f"Error processing reference image: {e}")
        else:
            # Text-only generation
            contents = f"{system_prompt}\n\nText prompt: {text_prompt}"
            print("🔄 Generating comic art from text prompt...")
        
        print("⏳ This may take 30-60 seconds...")
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash-image-preview",
                contents=contents,
            )
            
            print("✅ API request successful!")
            
            # Process response
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    image = Image.open(BytesIO(part.inline_data.data))
                    return image
            
            raise Exception("No image data found in response")
            
        except Exception as e:
            raise Exception(f"Error generating comic art: {e}")
    
    def save_image(self, image, filename):
        """
        Save generated image to file
        
        Args:
            image (PIL.Image): Image to save
            filename (str): Output filename
        """
        os.makedirs('generated_images', exist_ok=True)
        image.save(filename)
        print(f"💾 Saved image: {filename}")

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("🎨 Comic Art Generator")
        print("=====================")
        print()
        print("Usage: python comic_art_generator.py <text_prompt> [reference_image_path]")
        print()
        print("Examples:")
        print("  python comic_art_generator.py 'a superhero flying through the city'")
        print("  python comic_art_generator.py 'a dramatic fight scene' sketch.png")
        print()
        print("Generate comic art from text prompts and reference sketches!")
        return 1
    
    text_prompt = sys.argv[1]
    reference_image_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        # Initialize generator
        generator = ComicArtGenerator()
        
        # Check if reference image exists
        if reference_image_path and not os.path.exists(reference_image_path):
            print(f"⚠️ Reference image not found: {reference_image_path}")
            print("Proceeding with text-only generation...")
            reference_image_path = None
        
        # Generate comic art
        image = generator.generate_comic_art(text_prompt, reference_image_path)
        
        # Save the generated image
        safe_prompt = "".join(c for c in text_prompt if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_prompt = safe_prompt.replace(' ', '_')
        output_filename = f"generated_images/comic_{safe_prompt}.png"
        generator.save_image(image, output_filename)
        
        print("✅ Comic art generation completed!")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
