from flask import Blueprint, request, jsonify, Response, current_app, stream_with_context
import asyncio
import uuid

chat_controller = Blueprint('chat_controller', __name__, url_prefix='/api/chat')

class StreamContext:
    def __init__(self, session_id: str, user_message: str, custom_instructions: str = None):
        self.session_id = session_id
        self.user_message = user_message
        self.custom_instructions = custom_instructions

@chat_controller.route('/initiate', methods=['POST'])
def initiate_chat_stream():
    cache = current_app.cache
    data = request.get_json()
    session_id = data.get('sessionId')
    message = data.get('message')
    custom_instructions = data.get('customInstructions')

    if not session_id or not message:
        return jsonify({"detail": "Invalid request payload."}), 400

    stream_id = uuid.uuid4().hex
    context = StreamContext(session_id, message, custom_instructions)
    cache.set(stream_id, context)
    return jsonify({"streamId": stream_id})

@chat_controller.route('/stream/<stream_id>', methods=['GET'])
def get_chat_stream(stream_id):
    cache = current_app.cache
    from Services.chat_service import chat_service

    context = cache.get(stream_id)
    if not context:
        return jsonify({"detail": "Invalid or expired stream ID."}), 404

    request_data = {
        "session_id": context.session_id,
        "message": context.user_message,
        "custom_instructions": getattr(context, "custom_instructions", None)
    }

    # Just call the sync function!
    chunk_generator, _ = chat_service.stream_chat_completion_chunks(request_data)

    def event_stream():
        for chunk in chunk_generator:
            formatted_chunk = chunk.replace("\n", "<br>")
            yield formatted_chunk  # No SSE wrapping!
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # For nginx, if used
        "Content-Type": "application/octet-stream",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked"
    }

    return Response(stream_with_context(event_stream()), headers=headers)