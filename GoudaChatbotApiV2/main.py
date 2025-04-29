from flask import Flask
from Controllers.ChatController import chat_controller

app = Flask(__name__)
app.register_blueprint(chat_controller)


if __name__ == "__main__":
    # Run the app on localhost:5227
    app.run(host="127.0.0.1", port=5227, debug=True)