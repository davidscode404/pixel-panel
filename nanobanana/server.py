"""
Flask server for Comic Art Generator API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from comic_art_generator import ComicArtGenerator
import os
import tempfile
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Initialize the comic art generator
generator = ComicArtGenerator()

@app.route('/generate', methods=['POST'])
def generate_comic_art():
    """
    Generate comic art from text prompt and optional reference image
    
    Expected JSON payload:
    {
        "text_prompt": "string",
        "reference_image": "base64_encoded_image_data" (optional)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'text_prompt' not in data:
            return jsonify({'error': 'text_prompt is required'}), 400
        
        text_prompt = data['text_prompt']
        reference_image_data = data.get('reference_image')
        
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
                
                print(f"🔄 Processing reference image in memory...")
                
            except Exception as e:
                print(f"⚠️ Error processing reference image: {e}")
                reference_image_path = None
        
        # Generate comic art
        image = generator.generate_comic_art(text_prompt, reference_image_path)
        
        # Clean up temporary reference image file
        if reference_image_path and os.path.exists(reference_image_path):
            os.unlink(reference_image_path)
            print(f"🗑️ Cleaned up temporary reference image file")
        
        # Convert image to base64 for response
        from io import BytesIO
        img_buffer = BytesIO()
        image.save(img_buffer, format='PNG')
        img_bytes = img_buffer.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image_data': img_base64,
            'message': 'Comic art generated successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'comic-art-generator'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3004))
    app.run(host='0.0.0.0', port=port, debug=True)
