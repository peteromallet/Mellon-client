# Image Generation Server

This directory contains a FastAPI server that handles image generation requests using the fal.ai API.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in this directory with your fal.ai API key:
```
FAL_KEY=your_api_key_here
```

## Running the Server

Start the server with:
```bash
uvicorn server:app --reload
```

The server will run on `http://localhost:8000`.

## API Endpoints

### POST /generate
Generates an image based on a text prompt.

Request body:
```json
{
  "prompt": "string",
  "prompt_num": "integer",
  "fal_key": "string (optional)"
}
```

Response:
```json
{
  "success": true,
  "filename": "string",
  "message": "string"
}
```

or in case of error:
```json
{
  "success": false,
  "error": "string"
}
``` 