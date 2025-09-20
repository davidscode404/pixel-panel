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

@app.route('/save-panel', methods=['POST'])
def save_panel():
    """
    Save a comic panel image to the project directory
    """
    try:
        data = request.get_json()
        comic_title = data.get('comic_title')
        panel_id = data.get('panel_id')
        image_data = data.get('image_data')

        if not all([comic_title, panel_id, image_data]):
            return jsonify({'error': 'Missing required fields'}), 400

        # Create saved-comics directory if it doesn't exist
        import os
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        os.makedirs(saved_comics_dir, exist_ok=True)

        # Create comic-specific directory
        comic_dir = os.path.join(saved_comics_dir, comic_title)
        os.makedirs(comic_dir, exist_ok=True)

        # Save the panel image
        import base64
        image_bytes = base64.b64decode(image_data)
        panel_filename = f"panel_{panel_id}.png"
        panel_path = os.path.join(comic_dir, panel_filename)

        with open(panel_path, 'wb') as f:
            f.write(image_bytes)

        print(f"💾 Saved panel {panel_id} to: {panel_path}")
        return jsonify({'success': True, 'message': f'Panel {panel_id} saved successfully'})

    except Exception as e:
        print(f"❌ Error saving panel: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/list-comics', methods=['GET'])
def list_comics():
    """
    List all saved comics in the project directory
    """
    try:
        import os
        import glob
        
        # Look for saved comics directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        
        if not os.path.exists(saved_comics_dir):
            return jsonify({'comics': []})
        
        # Get all comic directories
        comic_dirs = [d for d in os.listdir(saved_comics_dir) 
                     if os.path.isdir(os.path.join(saved_comics_dir, d))]
        
        # Sort by modification time (newest first)
        comic_dirs.sort(key=lambda x: os.path.getmtime(os.path.join(saved_comics_dir, x)), reverse=True)
        
        comics = []
        for comic_dir in comic_dirs:
            # Check if it has panel files
            panel_files = glob.glob(os.path.join(saved_comics_dir, comic_dir, "panel_*.png"))
            if panel_files:
                comics.append({
                    'title': comic_dir,
                    'panel_count': len(panel_files)
                })
        
        return jsonify({'comics': comics})

    except Exception as e:
        print(f"❌ Error listing comics: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/load-comic/<path:comic_title>', methods=['GET'])
def load_comic(comic_title):
    """
    Load a saved comic from the project directory
    """
    try:
        import os
        import base64
        import glob
        from urllib.parse import unquote
        
        # Decode URL-encoded comic title
        decoded_title = unquote(comic_title)
        print(f"Loading comic: '{comic_title}' -> decoded: '{decoded_title}'")
        
        # Look for the comic directory
        saved_comics_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved-comics')
        comic_dir = os.path.join(saved_comics_dir, decoded_title)
        
        print(f"Looking for comic directory: {comic_dir}")
        
        if not os.path.exists(comic_dir):
            # List available comics for debugging
            available_comics = []
            if os.path.exists(saved_comics_dir):
                available_comics = [d for d in os.listdir(saved_comics_dir) 
                                  if os.path.isdir(os.path.join(saved_comics_dir, d))]
            print(f"Available comics: {available_comics}")
            return jsonify({'error': f'Comic not found. Available: {available_comics}'}), 404
        
        # Load all panel images
        panels = []
        for panel_id in range(1, 7):  # 6 panels
            panel_path = os.path.join(comic_dir, f"panel_{panel_id}.png")
            if os.path.exists(panel_path):
                with open(panel_path, 'rb') as f:
                    image_bytes = f.read()
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    panels.append({
                        'id': panel_id,
                        'image_data': f"data:image/png;base64,{image_base64}"
                    })
        
        return jsonify({
            'success': True,
            'comic_title': comic_title,
            'panels': panels
        })

    except Exception as e:
        print(f"❌ Error loading comic: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'comic-art-generator'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3004))
    app.run(host='0.0.0.0', port=port, debug=True)
