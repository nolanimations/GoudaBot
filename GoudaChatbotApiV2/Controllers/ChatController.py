from flask import Blueprint, request, jsonify, Response
import uuid

chat_controller = Blueprint('chat_controller', __name__, url_prefix='/api/chat')

# In-memory cache for stream contexts (for demo purposes)
stream_context_cache = {}

class StreamContext:
    def __init__(self, session_id: str, user_message: str, custom_instructions: str = None):
        self.session_id = session_id
        self.user_message = user_message
        self.custom_instructions = custom_instructions

@chat_controller.route('/initiate', methods=['POST'])
def initiate_chat_stream():
    print("WIP!")

@chat_controller.route('/stream/<stream_id>', methods=['GET'])
def get_chat_stream(stream_id):
    print("WIP!")