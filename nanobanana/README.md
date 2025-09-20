# Comic Art Generator Backend

A Python backend service that generates comic art using Google's Gemini 2.5 Flash model, based on text prompts and reference sketches.

## Features

- Generate comic art from text descriptions
- Use reference sketches to guide the generation
- RESTful API for frontend integration
- Support for both text-only and image+text generation

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables:**
   - Copy `env_example.txt` to `.env`
   - Add your Google API key:
     ```
     GOOGLE_API_KEY=your_google_api_key_here
     ```

3. **Run the server:**
   ```bash
   python server.py
   ```
   The server will start on `http://localhost:5000`

## API Endpoints

### POST /generate
Generate comic art from text prompt and optional reference image.

**Request Body:**
```json
{
  "text_prompt": "a superhero flying through the city",
  "reference_image": "base64_encoded_image_data" // optional
}
```

**Response:**
```json
{
  "success": true,
  "image_data": "base64_encoded_generated_image",
  "message": "Comic art generated successfully"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "comic-art-generator"
}
```

## Usage

### CLI Usage
```bash
# Generate from text only
python comic_art_generator.py "a superhero flying through the city"

# Generate with reference sketch
python comic_art_generator.py "a dramatic fight scene" sketch.png
```

### API Usage
```bash
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{"text_prompt": "a superhero flying through the city"}'
```

## System Prompt

The generator uses this system prompt:
> "You are a comic art generator. You generate art for panels based on a reference sketch from the user. Create clean, professional comic book style artwork that matches the reference sketch's composition and elements. Use bold lines, clear forms, and comic book aesthetics. Maintain the same perspective, character positions, and scene composition as shown in the reference sketch."

## Requirements

- Python 3.7+
- Google API key with Gemini 2.5 Flash access
- Internet connection for API calls

## Notes

- Generation typically takes 30-60 seconds
- Images are generated in PNG format
- Reference images should be sketches or simple drawings for best results
