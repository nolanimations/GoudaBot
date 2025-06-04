from flask import Flask
from flask_cors import CORS
from flask_caching import Cache
import openai # Keep for API key setup

from dotenv import load_dotenv # Keep for local .env loading

import os

app = Flask(__name__)

# --- Configure CORS from Environment Variable ---
allowed_origins_str = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173')
allowed_origins_list = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]
if not allowed_origins_list:
    print("WARNING: No ALLOWED_ORIGINS configured, CORS might block requests.")
else:
    print(f"Configuring CORS for Origins: {', '.join(allowed_origins_list)}")
CORS(app, origins=allowed_origins_list, supports_credentials=True)
# --- End CORS Configuration ---

# --- Load Environment Variables & Configure OpenAI API Key ---
load_dotenv() # Loads .env for local development
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    print("CRITICAL ERROR: OPENAI_API_KEY not set in environment! Application might not work.")
    # Might want to raise an exception here or handle it more gracefully
    # For now, we'll let it proceed and fail later if the key is truly needed by a service.
else:
    print("OpenAI API Key configured.")

# --- REMOVE VECTOR STORE CREATION AND FILE UPLOAD AT STARTUP ---
# The VECTOR_STORE_ID will now be read from environment variables by chat_service.py

# csvFileNames = ["Data/alle_organisaties.txt", "Data/events.txt", "Data/ingouda_onderwerpen.txt"]
# vector_store = openai.vector_stores.create(name="Gouda Data")
# app.config['VECTOR_STORE_ID'] = vector_store.id
#
# for filename in csvFileNames:
#     openai.vector_stores.files.upload_and_poll(
#         vector_store_id=vector_store.id,
#         file=open(filename, "rb")
#     )
# print(f"Vector Store {vector_store.id} configured and files uploaded.") # Optional: Log if you were creating it

# --- Configure Cache ---
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300
cache = Cache(app)
app.cache = cache
print("Flask-Caching initialized with SimpleCache.")
# --- End Cache Configuration ---


# --- Import and Register Blueprints ---
try:
    from Controllers.chat_controller import chat_controller
    app.register_blueprint(chat_controller)
    print("Chat controller registered successfully.")
except ImportError as e:
    print(f"CRITICAL ERROR: Error registering blueprint: {e}")
# --- End Blueprint Registration ---


# This part is only for LOCAL Flask development server, Gunicorn ignores it
if __name__ == "__main__":
    print("Attempting to run Flask development server...")
    # API key is already set globally if found by load_dotenv() and os.environ.get() above
    # No need to reset openai.api_key here unless specifically intended for local override only
    if not openai.api_key:
        print("WARNING: OPENAI_API_KEY still not found before running Flask dev server.")

    app.run(host="127.0.0.1", port=5227, debug=True)