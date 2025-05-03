from flask import Flask
from flask_cors import CORS
from flask_caching import Cache
import os # Import os to read environment variables

app = Flask(__name__)

# --- Configure CORS from Environment Variable ---
# Read allowed origins from environment variable, split by comma
allowed_origins_str = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173') # Default to localhost for safety
allowed_origins_list = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]

if not allowed_origins_list:
    print("WARNING: No ALLOWED_ORIGINS configured, CORS might block requests.")
    # Optionally set a restrictive default if needed, e.g., allow none
    # allowed_origins_list = []
else:
    print(f"Configuring CORS for Origins: {', '.join(allowed_origins_list)}")

# Apply CORS using the list read from environment variable
CORS(app, origins=allowed_origins_list, supports_credentials=True)
# --- End CORS Configuration ---


# Simple in-memory cache (for production, use 'redis' or 'memcached')
# Note: This cache will be lost when the F1 instance sleeps/restarts
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300 # Reduced timeout for stream context
cache = Cache(app)

app.cache = cache # Attach cache to app for access via current_app

# --- Import and Register Blueprints ---
# Ensure paths are correct if using folders
try:
    from Controllers.chat_controller import chat_controller
    # You might pass dependencies here if needed, but using current_app.cache is fine
    app.register_blueprint(chat_controller)
    print("Chat controller registered successfully.")
except ImportError as e:
    print(f"Error registering blueprint: {e}")
    # Handle error appropriately, maybe raise it to stop startup
# --- End Blueprint Registration ---

# This part is only for LOCAL Flask development server, Gunicorn ignores it
if __name__ == "__main__":
    # Load .env only for local development
    from dotenv import load_dotenv
    load_dotenv()
    print("Running Flask development server...")
    # For local dev, ensure the API key is loaded from .env before running
    openai_key_local = os.environ.get("OPENAI_API_KEY")
    if not openai_key_local:
        print("WARNING: OPENAI_API_KEY not found in environment for local run.")
    else:
         # Optionally set it for the openai client if not done elsewhere during local init
         import openai
         openai.api_key = openai_key_local

    # Make sure debug=False when running with gunicorn in production later
    app.run(host="127.0.0.1", port=5227, debug=True)
