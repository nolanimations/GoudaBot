from flask import Flask
from flask_cors import CORS
from flask_caching import Cache
from GoudaChatbotApiV2.Controllers.chat_controller import chat_controller

app = Flask(__name__)
CORS(app, origins=["https://goudabot.azurewebsites.net/"])

# Simple in-memory cache (for production, use 'redis' or 'memcached')
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 600  # seconds
cache = Cache(app)

# Pass cache to your controller if needed
app.register_blueprint(chat_controller)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5227, debug=True)