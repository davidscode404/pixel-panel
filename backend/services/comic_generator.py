"""
Comic Art Generator using Gemini 2.5 Flash
Generates comic art for panels based on reference sketches from users
"""

import os
import sys
import base64
import tempfile
import io
import logging
import google.generativeai as genai
from PIL import Image, ImageChops
from io import BytesIO
from dotenv import load_dotenv
import json
import numpy as np

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class ComicArtGenerator:
    def __init__(self):
        """Initialize the Comic Art Generator"""
        self.api_key = os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables")
        
        genai.configure(api_key=self.api_key)
        self.client = genai
    
    def remove_borders(self, image: Image.Image, threshold: int = 10) -> Image.Image:
        """
        Automatically detect and remove black/white borders from an image.
        
        Args:
            image: PIL Image to process
            threshold: Pixel variance threshold for border detection (lower = more aggressive)
        
        Returns:
            PIL Image with borders removed
        """
        try:
            # Convert to numpy array for easier processing
            img_array = np.array(image)
            
            # Get image dimensions
            height, width = img_array.shape[:2]
            
            # Function to check if a row/column is a border (low variance)
            def is_border_line(line):
                # Calculate variance across RGB channels
                variance = np.var(line)
                # Low variance indicates uniform color (border)
                return variance < threshold
            
            # Find top border
            top = 0
            for i in range(height):
                if not is_border_line(img_array[i, :]):
                    top = i
                    break
            
            # Find bottom border
            bottom = height
            for i in range(height - 1, -1, -1):
                if not is_border_line(img_array[i, :]):
                    bottom = i + 1
                    break
            
            # Find left border
            left = 0
            for i in range(width):
                if not is_border_line(img_array[:, i]):
                    left = i
                    break
            
            # Find right border
            right = width
            for i in range(width - 1, -1, -1):
                if not is_border_line(img_array[:, i]):
                    right = i + 1
                    break
            
            # Crop the image if borders were detected
            if top > 0 or bottom < height or left > 0 or right < width:
                cropped = image.crop((left, top, right, bottom))
                logger.info(f"Removed borders: top={top}, bottom={height-bottom}, left={left}, right={width-right}")
                return cropped
            else:
                logger.debug("No borders detected")
                return image
                
        except Exception as e:
            logger.warning(f"Error removing borders: {e}. Returning original image.")
            return image
    
    def generate_comic_art(self, text_prompt, reference_image_data=None, context_image_data=None, is_thumbnail=False):
        """
        Generate comic art based on text prompt and optional reference sketch
        
        Args:
            text_prompt (str): Text description for the comic panel
            reference_image_data (str): Base64 encoded reference sketch image data (optional)
            context_image_data (str): Base64 encoded context image data (optional)
            is_thumbnail (bool): Whether this is a thumbnail/cover (portrait 3:4) or panel (landscape 4:3)
            
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
                
                logger.debug("Processing reference image in memory...")
                
            except Exception as e:
                logger.error(f"Error processing reference image: {e}", exc_info=True)
                reference_image_path = None
        
        try:
            # Generate the comic art
            image = self._generate_art(text_prompt, reference_image_path, context_image_data, is_thumbnail)
            
            # Remove any black/white borders that may have been generated
            image = self.remove_borders(image)
            
            return image
        finally:
            # Clean up temporary reference image file
            if reference_image_path and os.path.exists(reference_image_path):
                os.unlink(reference_image_path)
                logger.debug("Cleaned up temporary reference image file")
    
    def _generate_art(self, text_prompt, reference_image_path=None, context_image_data=None, is_thumbnail=False):
        """
        Internal method to generate comic art
        """
        # Determine if we have context (subsequent panel generation)
        has_context = context_image_data is not None
        logger.debug(f"ComicArtGenerator: has_context={has_context}, is_thumbnail={is_thumbnail}, context_size={len(context_image_data) if context_image_data else 0}")
        
        if has_context:
            logger.info("Using context-aware generation with previous panel image")
        else:
            logger.info("Using standard generation without context")
        
        # Different prompts for thumbnail vs panels
        if is_thumbnail:
            system_prompt = (
                "You are a comic book cover art generator. Create a stunning, eye-catching comic book cover that captures the essence of the story. "
                "Use bold, dynamic composition with professional comic book style artwork. "
                "Create clean lines, vibrant colors, and dramatic composition typical of comic book covers. "
                "CRITICAL: The artwork MUST fill the ENTIRE image frame from edge to edge. NO borders, NO frames, NO white space, NO black bars. "
                "The image should bleed to all four edges. Do NOT add any white, black, or colored borders around the artwork. "
                "Do NOT include text, titles, or empty space around the artwork unless specifically requested in the prompt. "
                "Generate the image with a 3:4 aspect ratio (portrait orientation) - height should be taller than width. "
                "Ideal dimensions are 600x800 pixels or similar 3:4 proportions suitable for a comic book cover."
            )
        elif has_context:
            system_prompt = (
                "You are a comic art generator creating the next scene in a comic sequence. "
                "You have been provided with the previous panel as context. Create a new scene that follows naturally from the context, "
                "maintaining visual consistency in style, characters, and setting. Use the reference sketch as a guide for composition. "
                "Create clean, professional comic book style artwork with bold lines, clear forms, and comic book aesthetics. "
                "The new scene should feel like a natural continuation of the story. "
                "CRITICAL: The artwork MUST fill the ENTIRE image frame from edge to edge. NO borders, NO frames, NO white space, NO black bars. "
                "The image should bleed to all four edges. Do NOT add any white, black, or colored borders around the artwork. "
                "Generate the image with a 4:3 aspect ratio (landscape orientation) - width should be wider than height. "
                "Ideal dimensions are 800x600 pixels or similar 4:3 proportions."
            )
        else:
            system_prompt = (
                "You are a comic art generator. You generate art for panels based on a reference sketch from the user. "
                "Create clean, professional comic book style artwork that matches the reference sketch's composition and elements. "
                "Use bold lines, clear forms, and comic book aesthetics. Maintain the same perspective, character positions, "
                "and scene composition as shown in the reference sketch. "
                "CRITICAL: The artwork MUST fill the ENTIRE image frame from edge to edge. NO borders, NO frames, NO white space, NO black bars. "
                "The image should bleed to all four edges. Do NOT add any white, black, or colored borders around the artwork. "
                "Generate the image with a 4:3 aspect ratio (landscape orientation) - width should be wider than height. "
                "Ideal dimensions are 800x600 pixels or similar 4:3 proportions."
            )
        
        if reference_image_path:
            # Load image from file
            try:
                reference_image = Image.open(reference_image_path)
                logger.debug(f"Loaded reference image: {reference_image.size} pixels")
                
                # Convert to bytes for API
                img_buffer = BytesIO()
                reference_image.save(img_buffer, format='PNG')
                img_bytes = img_buffer.getvalue()
                logger.debug(f"Reference image size: {len(img_bytes)} bytes")

                # Create multimodal content with image and text
                # Convert image bytes to PIL Image for the API
                img = Image.open(io.BytesIO(img_bytes))

                # Create the prompt with image
                prompt_parts = [
                    img,
                    f"{system_prompt}\n\nText prompt: {text_prompt}"
                ]

                # Add context image if available
                if has_context:
                    try:
                        # Check if context_image_data is already a BytesIO object or needs base64 decoding
                        if hasattr(context_image_data, 'read'):
                            # It's already a BytesIO object
                            context_image_data.seek(0)  # Ensure we're at the beginning
                            context_img = Image.open(context_image_data)
                            context_img_bytes = context_image_data.getvalue()
                        else:
                            # It's base64 encoded string data
                            context_img_bytes = base64.b64decode(context_image_data)
                            context_bytes_io = io.BytesIO(context_img_bytes)
                            context_img = Image.open(context_bytes_io)
                        prompt_parts.insert(0, context_img)
                        logger.debug(f"Added context image to generation (size: {len(context_img_bytes)} bytes)")
                    except Exception as e:
                        logger.warning(f"Error processing context image: {e}", exc_info=True)
                
                logger.info("Generating comic art with reference sketch...")
                
            except Exception as e:
                raise Exception(f"Error processing reference image: {e}")
        else:
            # Text-only generation or context-only generation
            if has_context:
                # Context-only generation (no reference sketch)
                try:
                    # Check if context_image_data is already a BytesIO object or needs base64 decoding
                    if hasattr(context_image_data, 'read'):
                        # It's already a BytesIO object
                        context_image_data.seek(0)  # Ensure we're at the beginning
                        context_img = Image.open(context_image_data)
                        context_img_bytes = context_image_data.getvalue()
                    else:
                        # It's base64 encoded string data
                        context_img_bytes = base64.b64decode(context_image_data)
                        context_bytes_io = io.BytesIO(context_img_bytes)
                        context_img = Image.open(context_bytes_io)
                    prompt_parts = [
                        context_img,
                        f"{system_prompt}\n\nText prompt: {text_prompt}"
                    ]
                    logger.info(f"Generating comic art with context image only (size: {len(context_img_bytes)} bytes)...")
                except Exception as e:
                    logger.warning(f"Error processing context image: {e}", exc_info=True)
                    prompt_parts = f"{system_prompt}\n\nText prompt: {text_prompt}"
                    logger.info("Generating comic art from text prompt (context failed)...")
            else:
                # Text-only generation
                prompt_parts = f"{system_prompt}\n\nText prompt: {text_prompt}"
                logger.info("Generating comic art from text prompt...")
        
        logger.info("This may take 30-60 seconds...")
        
        try:
            model = self.client.GenerativeModel("gemini-2.5-flash-image-preview")
            response = model.generate_content(prompt_parts)
            
            logger.info("API request successful!")
            
            # Process response
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    # Create BytesIO object and ensure we're at the beginning
                    image_bytes = BytesIO(part.inline_data.data)
                    image_bytes.seek(0)
                    
                    try:
                        image = Image.open(image_bytes)
                        # Load the image immediately to catch any format errors
                        image.load()
                        return image
                    except Exception as img_error:
                        logger.error(f"Failed to open image: {img_error}. Data size: {len(part.inline_data.data)}")
                        raise Exception(f"Invalid image data received: {img_error}")
            
            raise Exception("No image data found in response")
            
        except Exception as e:
            logger.error(f"Error in ComicArtGenerator._generate_art: {e}", exc_info=True)
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
        logger.info(f"Saved image: {filename}")

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        logger.info("Comic Art Generator")
        logger.info("=====================")
        logger.info("")
        logger.info("Usage: python comic_art_generator.py <text_prompt> [reference_image_path]")
        logger.info("")
        logger.info("Examples:")
        logger.info("  python comic_art_generator.py 'a superhero flying through the city'")
        logger.info("  python comic_art_generator.py 'a dramatic fight scene' sketch.png")
        logger.info("")
        logger.info("Generate comic art from text prompts and reference sketches!")
        return 1
    
    text_prompt = sys.argv[1]
    reference_image_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        # Initialize generator
        generator = ComicArtGenerator()
        
        # Check if reference image exists
        if reference_image_path and not os.path.exists(reference_image_path):
            logger.warning(f"Reference image not found: {reference_image_path}")
            logger.info("Proceeding with text-only generation...")
            reference_image_path = None
        
        # Generate comic art
        image = generator.generate_comic_art(text_prompt, reference_image_path)
        
        # Save the generated image
        safe_prompt = "".join(c for c in text_prompt if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_prompt = safe_prompt.replace(' ', '_')
        output_filename = f"generated_images/comic_{safe_prompt}.png"
        generator.save_image(image, output_filename)
        
        logger.info("Comic art generation completed!")
        
        return 0
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    exit(main())
