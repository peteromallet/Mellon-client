from flask import Flask
from flask_cors import CORS
from routes.nodeData import node_data
import os

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(node_data)

if __name__ == '__main__':
    print(f"Server starting in directory: {os.getcwd()}")
    print(f"Looking for data directory at: {os.path.join(os.getcwd(), 'data')}")
    app.run(host='0.0.0.0', port=5001) 