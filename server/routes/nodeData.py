import os
import json
import fcntl
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import traceback

node_data = Blueprint('node_data', __name__)

DATA_DIR = 'data'
FILES_DIR = 'files'

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

@node_data.route('/test')
def test():
    """Test endpoint to verify server is working"""
    return jsonify({"status": "ok", "message": "Server is running"})

def ensure_dirs(node_name):
    """Ensure the data and files directories exist for a node"""
    try:
        print(f"\n=== Ensuring directories for node: {node_name} ===")
        print(f"Current working directory: {os.getcwd()}")
        
        # Get absolute paths
        base_dir = os.getcwd()
        node_data_dir = os.path.join(base_dir, DATA_DIR, node_name)
        node_files_dir = os.path.join(base_dir, DATA_DIR, FILES_DIR, node_name)
        
        # Create directories if they don't exist
        os.makedirs(os.path.join(base_dir, DATA_DIR), exist_ok=True)
        os.makedirs(node_data_dir, exist_ok=True)
        os.makedirs(os.path.join(base_dir, DATA_DIR, FILES_DIR), exist_ok=True)
        os.makedirs(node_files_dir, exist_ok=True)
        
        print(f"Successfully created/verified directories:")
        print(f"- Data dir: {node_data_dir}")
        print(f"- Files dir: {node_files_dir}")
        
        return node_data_dir, node_files_dir
    except Exception as e:
        print(f"Error in ensure_dirs: {str(e)}")
        print(traceback.format_exc())
        raise

@node_data.route('/node/<node_name>/data', methods=['GET', 'POST'])
def handle_node_data(node_name):
    """Handle both GET and POST for node data"""
    try:
        print(f"\n=== Handling {request.method} request for node: {node_name} ===")
        print(f"Current working directory: {os.getcwd()}")
        
        # Ensure directories exist and get absolute paths
        node_data_dir, _ = ensure_dirs(node_name)
        data_path = os.path.join(node_data_dir, 'data.json')
        print(f"Data path: {data_path}")
        
        if request.method == 'GET':
            if not os.path.exists(data_path):
                print(f"File not found at: {data_path}")
                return '', 404
                
            print(f"Reading file: {data_path}")
            try:
                with open(data_path, 'r') as f:
                    data = json.load(f)
                    print(f"Successfully loaded data: {data}")
                    return jsonify(data)
            except json.JSONDecodeError:
                print(f"Invalid JSON in file: {data_path}")
                # If JSON is invalid, delete the file and return 404
                os.remove(data_path)
                return '', 404
                
        elif request.method == 'POST':
            data = request.get_json()
            print(f"Received POST data: {data}")
            
            # Write data atomically
            atomic_write_json(data_path, data)
            print(f"Successfully saved data to: {data_path}")
            return '', 200
            
    except json.JSONDecodeError as e:
        error_msg = f"JSON decode error: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        error_msg = f"Unexpected error ({type(e).__name__}): {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500

@node_data.route('/node/<node_name>/data', methods=['DELETE'])
def delete_node_data(node_name):
    """Delete node data and files"""
    try:
        print(f"\n=== Handling DELETE request for node: {node_name} ===")
        node_data_dir = os.path.join(DATA_DIR, node_name)
        node_files_dir = os.path.join(DATA_DIR, FILES_DIR, node_name)
        
        # Delete data.json if it exists
        data_path = os.path.join(node_data_dir, 'data.json')
        if os.path.exists(data_path):
            print(f"Deleting data file: {data_path}")
            os.remove(data_path)
        
        # Delete files directory if it exists
        if os.path.exists(node_files_dir):
            print(f"Deleting files directory: {node_files_dir}")
            for file in os.listdir(node_files_dir):
                file_path = os.path.join(node_files_dir, file)
                print(f"Deleting file: {file_path}")
                os.remove(file_path)
            os.rmdir(node_files_dir)
        
        # Delete node directory if empty
        if os.path.exists(node_data_dir) and not os.listdir(node_data_dir):
            print(f"Deleting empty node directory: {node_data_dir}")
            os.rmdir(node_data_dir)
        
        return '', 200
    except Exception as e:
        error_msg = f"Error deleting data: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500

@node_data.route('/node/<node_name>/file', methods=['POST'])
def save_node_file(node_name):
    """Save a file to data/files/{node_name}/"""
    try:
        print(f"\n=== Handling POST request for file from node: {node_name} ===")
        print(f"Current working directory: {os.getcwd()}")
        
        _, node_files_dir = ensure_dirs(node_name)
        
        if 'file' not in request.files:
            print("No file provided in request")
            return 'No file provided', 400
            
        file = request.files['file']
        if not file.filename:
            print("Empty filename")
            return 'Empty filename', 400
            
        filename = secure_filename(file.filename)
        file_path = os.path.join(node_files_dir, filename)
        print(f"Saving file to: {file_path}")
        
        # Delete existing file if it exists
        if os.path.exists(file_path):
            print(f"Deleting existing file: {file_path}")
            os.remove(file_path)
            
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        file.save(file_path)
        print(f"Successfully saved file: {file_path}")
        
        # Verify file was saved
        if not os.path.exists(file_path):
            print(f"File was not saved successfully: {file_path}")
            return jsonify({"error": "File was not saved successfully"}), 500
            
        return '', 200
        
    except Exception as e:
        error_msg = f"Error saving file: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500

@node_data.route('/node/<node_name>/file/<filename>')
def get_node_file(node_name, filename):
    """Get a file from data/files/{node_name}/"""
    try:
        print(f"\n=== Handling GET request for file: {filename} from node: {node_name} ===")
        print(f"Current working directory: {os.getcwd()}")
        
        # Get absolute paths
        base_dir = os.getcwd()
        node_files_dir = os.path.join(base_dir, DATA_DIR, FILES_DIR, node_name)
        
        # Ensure the filename is secure and decode URL encoding
        safe_filename = secure_filename(filename)
        file_path = os.path.join(node_files_dir, safe_filename)
        print(f"Looking for file at: {file_path}")
        
        if not os.path.exists(file_path):
            print(f"File not found at: {file_path}")
            return '', 404
            
        if not os.access(file_path, os.R_OK):
            print(f"No read permission for: {file_path}")
            return jsonify({"error": "No permission to read file"}), 500
            
        # Determine MIME type based on file extension
        mime_type = 'application/octet-stream'
        if filename.lower().endswith(('.mp4', '.m4v')):
            mime_type = 'video/mp4'
        elif filename.lower().endswith(('.mp3', '.wav')):
            mime_type = 'audio/mpeg'
            
        print(f"Sending file: {file_path} with MIME type: {mime_type}")
        try:
            return send_file(
                file_path,
                mimetype=mime_type,
                as_attachment=False  # Stream instead of download
            )
        except Exception as send_error:
            print(f"Error sending file: {str(send_error)}")
            print(traceback.format_exc())
            return jsonify({"error": f"Error sending file: {str(send_error)}"}), 500
            
    except Exception as e:
        error_msg = f"Error loading file: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500 