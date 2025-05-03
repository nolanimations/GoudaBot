from flask import Flask
from flask_cors import CORS
from flask_caching import Cache


app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "https://goudabot2.azurewebsites.net"], supports_credentials=True)

# Simple in-memory cache (for production, use 'redis' or 'memcached')
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 600  # seconds
cache = Cache(app)

app.cache = cache  # <-- Attach cache to app

from Controllers.chat_controller import chat_controller

# Pass cache to your controller if needed
app.register_blueprint(chat_controller)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5227, debug=True)