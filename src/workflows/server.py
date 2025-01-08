import os
import time
import requests
import uvicorn
import json
import fcntl
import psutil
import datetime
import anthropic
from typing import Dict, Optional, List
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import asyncio
from werkzeug.utils import secure_filename

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend development server
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"]  # Expose all headers
)

# Constants for node data functionality
DATA_DIR = 'data'
FILES_DIR = os.path.join(DATA_DIR, 'files')  # All files go directly in data/files

# Keep existing models
class GenerateRequest(BaseModel):
    prompt: str
    prompt_num: int
    fal_key: Optional[str] = None

class BatchGenerateRequest(BaseModel):
    prompts: Dict[int, str]
    fal_key: Optional[str] = None

# Add new models for Claude API
class PromptGenerateRequest(BaseModel):
    topic: str
    examples: List[str]
    mode: str
    numToGenerate: Optional[int] = 5

# Node data helper functions
def atomic_write_json(data_path, data):
    """Write data to a file atomically using a lock file"""
    lock_path = data_path + '.lock'
    temp_path = data_path + '.tmp'
    
    try:
        # Ensure parent directory exists
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        
        # Create lock file
        with open(lock_path, 'w') as lock_file:
            # Get exclusive lock
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                # Write to temp file
                with open(temp_path, 'w') as f:
                    json.dump(data, f, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                
                # Atomic rename
                os.replace(temp_path, data_path)
            finally:
                # Release lock
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
    finally:
        # Clean up
        if os.path.exists(lock_path):
            os.remove(lock_path)
        if os.path.exists(temp_path):
            os.remove(temp_path)

def ensure_dirs():
    """Ensure the data and files directories exist"""
    try:
        base_dir = os.getcwd()
        data_dir = os.path.join(base_dir, DATA_DIR)
        files_dir = os.path.join(base_dir, FILES_DIR)
        
        # Create directories if they don't exist
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(files_dir, exist_ok=True)
        
        return data_dir, files_dir
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ensuring directories: {str(e)}")

# Node data routes
@app.get("/test")
async def test():
    """Test endpoint to verify server is working"""
    return {"status": "ok", "message": "Server is running"}

def get_process_memory():
    """Get current process memory usage in MB"""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024

def log_performance(message: str, memory_before: float = None):
    """Log a performance message with timestamp and memory usage"""
    current_memory = get_process_memory()
    timestamp = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
    memory_diff = f"(Δ: {current_memory - memory_before:.1f}MB)" if memory_before is not None else ""
    print(f"[{timestamp}] {message} - Memory: {current_memory:.1f}MB {memory_diff}")
    return current_memory

class NodeCache:
    def __init__(self, write_delay=5):
        self.cache = {}
        self.last_write = {}
        self.dirty = set()
        self.write_delay = write_delay
        self.lock = asyncio.Lock()
        self.stats = {
            "total_writes": 0,
            "total_bytes_written": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "peak_memory": 0,
        }
        log_performance("Initialized NodeCache")

    async def get(self, node_name: str):
        mem_before = get_process_memory()
        if node_name not in self.cache:
            self.stats["cache_misses"] += 1
            log_performance(f"Cache MISS for {node_name}", mem_before)
            data_dir, _ = ensure_dirs()
            data_path = os.path.join(data_dir, node_name, 'data.json')
            if os.path.exists(data_path):
                try:
                    with open(data_path, 'r') as f:
                        start_time = time.time()
                        self.cache[node_name] = json.load(f)
                        log_performance(f"Loaded {node_name} from disk in {(time.time() - start_time)*1000:.1f}ms")
                except json.JSONDecodeError:
                    self.cache[node_name] = {}
            else:
                self.cache[node_name] = {}
        else:
            self.stats["cache_hits"] += 1
            log_performance(f"Cache HIT for {node_name}", mem_before)
        
        # Track peak memory
        current_memory = get_process_memory()
        self.stats["peak_memory"] = max(self.stats["peak_memory"], current_memory)
        return self.cache[node_name]

    async def set(self, node_name: str, data: dict):
        async with self.lock:
            mem_before = get_process_memory()
            data_size = len(str(data))
            log_performance(f"Setting data for {node_name} (size: {data_size:,} bytes)", mem_before)
            
            self.cache[node_name] = data
            self.dirty.add(node_name)
            current_time = time.time()
            
            if (node_name not in self.last_write or 
                current_time - self.last_write.get(node_name, 0) >= self.write_delay):
                await self.flush(node_name)
            else:
                time_until_write = self.write_delay - (current_time - self.last_write.get(node_name, 0))
                log_performance(f"Delaying write for {node_name} - {time_until_write:.1f}s until next write")

    async def flush(self, node_name: str):
        if node_name in self.dirty:
            mem_before = get_process_memory()
            start_time = time.time()
            
            data_dir, _ = ensure_dirs()
            node_dir = os.path.join(data_dir, node_name)
            os.makedirs(node_dir, exist_ok=True)
            data_path = os.path.join(node_dir, 'data.json')
            
            data_size = len(str(self.cache[node_name]))
            
            atomic_write_json(data_path, self.cache[node_name])
            write_time = time.time() - start_time
            
            self.last_write[node_name] = time.time()
            self.dirty.remove(node_name)
            
            self.stats["total_writes"] += 1
            self.stats["total_bytes_written"] += data_size
            
            log_performance(
                f"Wrote {data_size:,} bytes to disk for {node_name} in {write_time*1000:.1f}ms", 
                mem_before
            )
            
            print(f"\nCache Performance Stats:")
            print(f"  Total writes: {self.stats['total_writes']:,}")
            print(f"  Total bytes written: {self.stats['total_bytes_written']:,}")
            print(f"  Cache hits/misses: {self.stats['cache_hits']:,}/{self.stats['cache_misses']:,}")
            print(f"  Current memory: {get_process_memory():.1f}MB")
            print(f"  Peak memory: {self.stats['peak_memory']:.1f}MB")

    async def delete(self, node_name: str):
        async with self.lock:
            mem_before = get_process_memory()
            if node_name in self.cache:
                data_size = len(str(self.cache[node_name]))
                log_performance(f"Deleting {node_name} from cache (size: {data_size:,} bytes)", mem_before)
                del self.cache[node_name]
            if node_name in self.dirty:
                self.dirty.remove(node_name)
            if node_name in self.last_write:
                del self.last_write[node_name]

# Initialize the cache
node_cache = NodeCache()

# Replace the node data endpoints with cached versions
@app.get("/node/{node_name}/data")
async def get_node_data(node_name: str):
    """Get node data"""
    try:
        data = await node_cache.get(node_name)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/node/{node_name}/data")
async def post_node_data(node_name: str, data: dict):
    """Save node data"""
    try:
        await node_cache.set(node_name, data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/node/{node_name}/data")
async def delete_node_data(node_name: str):
    """Delete node data"""
    try:
        await node_cache.delete(node_name)
        data_dir, _ = ensure_dirs()
        node_dir = os.path.join(data_dir, node_name)
        data_path = os.path.join(node_dir, 'data.json')
        
        # Delete data.json if it exists
        if os.path.exists(data_path):
            os.remove(data_path)
        
        # Delete node directory if empty
        if os.path.exists(node_dir) and not os.listdir(node_dir):
            os.rmdir(node_dir)
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# File routes - only direct access to data/files
@app.get("/data/files/{filename}")
async def get_file(filename: str):
    """Get a file directly from data/files/"""
    try:
        # Get absolute paths
        base_dir = os.getcwd()
        files_dir = os.path.join(base_dir, FILES_DIR)
        
        # Ensure the filename is secure and doesn't contain path traversal
        safe_filename = secure_filename(filename)
        file_path = os.path.join(files_dir, safe_filename)
        
        # Check if path is a directory
        if os.path.isdir(file_path):
            raise HTTPException(status_code=400, detail="Cannot access directories")
            
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        if not os.access(file_path, os.R_OK):
            raise HTTPException(status_code=500, detail="No permission to read file")
            
        # Determine media type based on file extension
        media_type = None
        if filename.lower().endswith(('.mp4', '.m4v')):
            media_type = 'video/mp4'
        elif filename.lower().endswith(('.mp3', '.wav')):
            media_type = 'audio/mpeg'
        elif filename.lower().endswith(('.jpg', '.jpeg')):
            media_type = 'image/jpeg'
        elif filename.lower().endswith('.png'):
            media_type = 'image/png'
            
        return FileResponse(file_path, media_type=media_type)
            
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/data/files")
async def save_file(file: UploadFile = File(...)):
    """Save a file to data/files/"""
    try:
        base_dir = os.getcwd()
        files_dir = os.path.join(base_dir, FILES_DIR)
        os.makedirs(files_dir, exist_ok=True)
        
        if not file.filename:
            raise HTTPException(status_code=400, detail="Empty filename")
            
        filename = secure_filename(file.filename)
        file_path = os.path.join(files_dir, filename)
        
        # Delete existing file if it exists
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # Save the new file
        contents = await file.read()
        with open(file_path, 'wb') as f:
            f.write(contents)
        
        # Verify file was saved
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="File was not saved successfully")
            
        return {"status": "success"}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/data/files/{filename}")
async def delete_file(filename: str):
    """Delete a specific file from data/files/"""
    try:
        base_dir = os.getcwd()
        files_dir = os.path.join(base_dir, FILES_DIR)
        safe_filename = secure_filename(filename)
        file_path = os.path.join(files_dir, safe_filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Keep existing image generation functions and routes
def ensure_directory_exists(directory: str) -> None:
    """Create directory if it doesn't exist."""
    Path(directory).mkdir(parents=True, exist_ok=True)

def generate_image(prompt: str, prompt_num: int, fal_key: Optional[str] = None) -> dict:
    """Generate an image using the fal.ai API and save it locally."""
    if not fal_key:
        fal_key = os.getenv('FAL_KEY')
        if not fal_key:
            raise ValueError("FAL_KEY not found in environment variables")

    url = "https://fal.run/fal-ai/flux-lora"
    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "prompt": prompt,
        "image_size": "square_hd",
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
        "num_images": 1,
        "enable_safety_checker": True,
        "output_format": "jpeg",
        "loras": [
            {
                "path": "https://v3.fal.media/files/elephant/x_sot6QtB128Jof_YZMSL_pytorch_lora_weights.safetensors",
                "scale": 0.8
            }
        ]
    }
    
    try:
        # Ensure the files directory exists
        base_dir = os.getcwd()
        files_dir = os.path.join(base_dir, FILES_DIR)
        os.makedirs(files_dir, exist_ok=True)
        
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        result = response.json()
        if 'images' not in result or not result['images']:
            raise ValueError("No image URL in response")
        
        results = []
        for idx, image_data in enumerate(result['images']):
            image_url = image_data['url']
            
            # Download the image
            image_response = requests.get(image_url)
            image_response.raise_for_status()
            
            # Find an available filename
            base_filename = f"image_{prompt_num:03d}"
            counter = idx + 1
            filename = f"{base_filename}-{counter}.jpg"
            file_path = os.path.join(files_dir, filename)
            
            while os.path.exists(file_path):
                counter += 1
                filename = f"{base_filename}-{counter}.jpg"
                file_path = os.path.join(files_dir, filename)
            
            # Save the image
            with open(file_path, 'wb') as f:
                f.write(image_response.content)
                
            results.append({
                "success": True,
                "filename": filename,
                "message": f"Generated and saved image as {filename}"
            })
            
        return results[0] if len(results) == 1 else results
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"API request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating image: {str(e)}")

async def generate_batch(prompts: Dict[int, str], fal_key: Optional[str] = None) -> list:
    """Generate images for multiple prompts with rate limiting."""
    results = []
    for prompt_num, prompt in prompts.items():
        try:
            result = generate_image(prompt, prompt_num, fal_key)
            # Handle both single and multiple image results
            if isinstance(result, list):
                results.extend(result)
            else:
                results.append(result)
            # Rate limiting
            await asyncio.sleep(1)
        except Exception as e:
            results.append({
                "success": False,
                "prompt_num": prompt_num,
                "error": str(e)
            })
    return results

@app.post("/generate")
async def generate_endpoint(request: GenerateRequest):
    try:
        return generate_image(request.prompt, request.prompt_num, request.fal_key)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-batch")
async def generate_batch_endpoint(request: BatchGenerateRequest):
    try:
        print(f"Received batch request with prompts: {request.prompts}")
        results = await generate_batch(request.prompts, request.fal_key)
        print(f"Generated batch results: {results}")
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def generate_image_stream(prompt: str, prompt_num: int, fal_key: Optional[str] = None) -> dict:
    """Generate a single image and return it immediately."""
    try:
        result = generate_image(prompt, prompt_num, fal_key)
        return result
    except Exception as e:
        return {
            "success": False,
            "prompt_num": prompt_num,
            "error": str(e)
        }

async def stream_batch_generation(prompts: Dict[int, str], fal_key: Optional[str] = None):
    """Stream the generation of multiple images."""
    for prompt_num, prompt in prompts.items():
        result = await generate_image_stream(prompt, prompt_num, fal_key)
        yield f"data: {json.dumps(result)}\n\n"
        await asyncio.sleep(1)  # Rate limiting
    yield "data: {\"done\": true}\n\n"

@app.post("/generate-batch-stream")
async def generate_batch_stream_endpoint(request: BatchGenerateRequest):
    """Stream the batch generation results as they're completed."""
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "http://localhost:5173"
    }
    return StreamingResponse(
        stream_batch_generation(request.prompts, request.fal_key),
        headers=headers
    )

# Add Claude client initialization
def get_claude_client():
    api_key = os.getenv('CLAUDE_API_KEY')
    if not api_key:
        raise ValueError("CLAUDE_API_KEY not found in environment variables")
    return anthropic.Anthropic(api_key=api_key)

async def generate_prompts_with_claude(topic: str, examples: List[str], mode: str, num_to_generate: int = 5) -> List[str]:
    """Generate prompts using Claude API."""
    client = get_claude_client()
    
    # Construct the system message and user message based on mode
    if mode == "add":
        system_msg = "You are a creative prompt generator. Your task is to add new prompts to an existing list while maintaining the same style and theme. Each new prompt should be unique and different from the existing ones."
        user_msg = f"""Here is a topic and some existing prompts. Add {num_to_generate} new prompts that complement the existing ones.
        
Topic: {topic}

Existing prompts:
{chr(10).join(f'{i+1}. {example}' for i, example in enumerate(examples) if example.strip())}

Requirements:
1. Generate exactly {num_to_generate} NEW prompts that would fit well with the existing ones
2. Each new prompt MUST be unique and different from ALL existing prompts
3. Maintain the same style, tone, and format as the examples
4. Each prompt should be unique but thematically consistent
5. Output ONLY the new prompts, one per line - DON'T add numbering or other formatting
6. Do NOT repeat or rephrase any existing prompts
"""

    elif mode == "edit":
        system_msg = "You are a prompt editor and improver. Your task is to enhance existing prompts while maintaining their core meaning and intent. Do not add or remove any prompts."
        user_msg = f"""Here are some prompts that need to be improved. Edit them to be more effective while keeping their original intent.
        
Topic: {topic}

Prompts to improve:
{chr(10).join(f'{i+1}. {example}' for i, example in enumerate(examples) if example.strip())}

Requirements:
1. Return EXACTLY the same number of prompts as provided - do not add or remove any
2. Improve each prompt based on user instructions while keeping its core meaning intact
3. Make them more clear and engaging while preserving the original intent
4. Do NOT change the fundamental structure or purpose of any prompt - DO NOT add numbering or other formatting
5. Output ONLY the improved prompts, one per line, in the same order
"""

    else:  # new
        system_msg = "You are a creative prompt generator. Your task is to generate entirely new prompts based on a topic and example style."
        user_msg = f"""Generate new prompts based on this topic, using the examples only as a style reference.
        
Topic: {topic}

Style examples:
{chr(10).join(f'{i+1}. {example}' for i, example in enumerate(examples) if example.strip())}

Requirements:
1. Generate exactly {num_to_generate} completely new prompts about the topic
2. Use the examples only as a reference for style/format - do not copy the examples verbatim
3. Be creative and diverse in your approach
4. Output ONLY the new prompts, one per line - DON'T add numbering or other formatting

"""
    
    try:
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            temperature=1,
            system=system_msg,
            messages=[
                {"role": "user", "content": user_msg}
            ]
        )
        
        # Parse response and extract prompts
        response_text = message.content[0].text
        prompts = [line.strip() for line in response_text.split('\n') if line.strip()]
        
        # For edit mode, ensure we don't return more prompts than we received
        if mode == "edit":
            if len(prompts) != len(examples):
                print(f"Warning: Claude returned {len(prompts)} prompts but expected {len(examples)}")
                prompts = prompts[:len(examples)]  # Truncate if too many
                if len(prompts) < len(examples):  # Pad if too few
                    prompts.extend(examples[len(prompts):])
            return prompts
        else:
            return prompts[:num_to_generate]  # For add and new modes, return requested number
        
    except Exception as e:
        print(f"Claude API error: {str(e)}")  # Add debug logging
        raise HTTPException(status_code=500, detail=f"Error generating prompts: {str(e)}")

@app.post("/generate-prompts")
async def generate_prompts_endpoint(request: PromptGenerateRequest):
    """Generate prompts using Claude API."""
    try:
        prompts = await generate_prompts_with_claude(
            request.topic,
            request.examples,
            request.mode,
            request.numToGenerate
        )
        return {"prompts": prompts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print(f"Server starting in directory: {os.getcwd()}")
    print(f"Looking for data directory at: {os.path.join(os.getcwd(), 'data')}")
    uvicorn.run(app, host="0.0.0.0", port=5001) 