"""
Comic Art Generator using Gemini 2.5 Flash
Generates comic art for panels based on reference sketches from users
"""

import os
import sys
import base64
import tempfile
import google.generativeai as genai
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
        
        genai.configure(api_key=self.api_key)
        self.client = genai
    
    def generate_comic_art(self, text_prompt, reference_image_data=None, context_image_data=None):
        """
        Generate comic art based on text prompt and optional reference sketch
        
        Args:
            text_prompt (str): Text description for the comic panel
            reference_image_data (str): Base64 encoded reference sketch image data (optional)
            context_image_data (str): Base64 encoded context image data (optional)
            
        Returns:
            PIL.Image: Generated comic art image
        """
        # Process reference image if provided
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
        
        try:
            # Generate the comic art
            image = self._generate_art(text_prompt, reference_image_path, context_image_data)
            return image
        finally:
            # Clean up temporary reference image file
            if reference_image_path and os.path.exists(reference_image_path):
                os.unlink(reference_image_path)
                print(f"Cleaned up temporary reference image file")
    
    def _generate_art(self, text_prompt, reference_image_path=None, context_image_data=None):
        """
        Internal method to generate comic art
        """
        # Determine if we have context (subsequent panel generation)
        has_context = context_image_data is not None
        print(f"🔍 ComicArtGenerator: has_context={has_context}, context_size={len(context_image_data) if context_image_data else 0}")
        
        if has_context:
            print(f"🎨 Using context-aware generation with previous panel image")
        else:
            print(f"🎨 Using standard generation without context")
        
        if has_context:
            system_prompt = (
                "You are a comic art generator creating the next scene in a comic sequence. "
                "You have been provided with the previous panel as context. Create a new scene that follows naturally from the context, "
                "maintaining visual consistency in style, characters, and setting. Use the reference sketch as a guide for composition. "
                "Create clean, professional comic book style artwork with bold lines, clear forms, and comic book aesthetics. "
                "The new scene should feel like a natural continuation of the story. "
                "Fill the entire image frame with artwork - the composition should extend edge-to-edge without empty borders. "
                "Do NOT include white borders or empty white space around the artwork unless specifically requested in the prompt."
            )
        else:
            system_prompt = (
                "You are a comic art generator. You generate art for panels based on a reference sketch from the user. "
                "Create clean, professional comic book style artwork that matches the reference sketch's composition and elements. "
                "Use bold lines, clear forms, and comic book aesthetics. Maintain the same perspective, character positions, "
                "and scene composition as shown in the reference sketch. "
                "Fill the entire image frame with artwork - the composition should extend edge-to-edge without empty borders. "
                "Do NOT include white borders or empty white space around the artwork unless specifically requested in the prompt."
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
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(img_bytes).decode('utf-8')
                        }
                    },
                    {
                        "text": f"{system_prompt}\n\nText prompt: {text_prompt}"
                    }
                ]
                
                # Add context image if available
                if has_context:
                    try:
                        context_img_bytes = base64.b64decode(context_image_data)
                        contents.insert(0, {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": base64.b64encode(context_img_bytes).decode('utf-8')
                            }
                        })
                        print(f"🖼️ Added context image to generation (size: {len(context_img_bytes)} bytes)")
                    except Exception as e:
                        print(f"⚠️ Error processing context image: {e}")
                
                print("🔄 Generating comic art with reference sketch...")
                
            except Exception as e:
                raise Exception(f"Error processing reference image: {e}")
        else:
            # Text-only generation or context-only generation
            if has_context:
                # Context-only generation (no reference sketch)
                try:
                    context_img_bytes = base64.b64decode(context_image_data)
                    contents = [
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": base64.b64encode(context_img_bytes).decode('utf-8')
                            }
                        },
                        {
                            "text": f"{system_prompt}\n\nText prompt: {text_prompt}"
                        }
                    ]
                    print(f"🔄 Generating comic art with context image only (size: {len(context_img_bytes)} bytes)...")
                except Exception as e:
                    print(f"⚠️ Error processing context image: {e}")
                    contents = f"{system_prompt}\n\nText prompt: {text_prompt}"
                    print("🔄 Generating comic art from text prompt (context failed)...")
            else:
                # Text-only generation
                contents = f"{system_prompt}\n\nText prompt: {text_prompt}"
                print("🔄 Generating comic art from text prompt...")
        
        print("⏳ This may take 30-60 seconds...")
        
        try:
            model = self.client.GenerativeModel("gemini-2.5-flash-image-preview")
            response = model.generate_content(contents)
            
            print("✅ API request successful!")
            
            # Process response
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    image = Image.open(BytesIO(part.inline_data.data))
                    return image
            
            raise Exception("No image data found in response")
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"❌ Error in ComicArtGenerator._generate_art: {e}")
            print(f"📋 Full traceback: {error_details}")
            raise Exception(f"Error generating comic art: {e}")
    
    def image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        img_buffer = BytesIO()
        image.save(img_buffer, format='PNG')
        img_bytes = img_buffer.getvalue()
        return base64.b64encode(img_bytes).decode('utf-8')
    
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
