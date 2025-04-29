# Controllers/ChatController.py

from flask import Blueprint, request, jsonify, Response
from Services.ChatService import ChatService
from Models.ChatRequest import ChatRequest
from Utils.cache_manager import SimpleCache
import uuid
import asyncio
import logging

cache = SimpleCache()

chat_controller = Blueprint('chat_controller', __name__, url_prefix='/api/chat')
logger = logging.getLogger(__name__)

chat_service = ChatService()

def create_stream_context(session_id, user_message, custom_instructions=None):
    return {
        "session_id": session_id,
        "user_message": user_message,
        "custom_instructions": custom_instructions
    }

@chat_controller.route('/initiate', methods=['POST'])
def initiate_chat_stream():
    data = request.get_json()
    if not data or not data.get('session_id') or not data.get('message'):
        return jsonify({"error": "Invalid request payload."}), 400

    stream_id = uuid.uuid4().hex
    context = create_stream_context(
        session_id=data['session_id'],
        user_message=data['message'],
        custom_instructions=data.get('custom_instructions')
    )

    cache.set(stream_id, context, ttl_seconds=60)


    logger.info(f"Chat stream initiated. SessionId: {data['session_id']}, StreamId: {stream_id}")

    return jsonify({"streamId": stream_id}), 200


# GET /api/chat/stream/<stream_id>
@chat_controller.route('/stream/<stream_id>', methods=['GET'])
def get_chat_stream(stream_id):
    logger.info(f"SSE GET request received for StreamId: {stream_id}")

    context = cache.get(stream_id)

    if not context:
        logger.warning(f"Stream context not found or expired for StreamId: {stream_id}")
        return Response("event: error\ndata: Invalid or expired stream ID.\n\n", mimetype='text/event-stream', status=404)

    async def event_stream():
        full_response = ""
        stream_succeeded = False

        try:
            stream_request = ChatRequest(
                session_id=context['session_id'],
                message=context['user_message'],
                custom_instructions=context.get('custom_instructions')
            )

            async for chunk in chat_service.stream_chat_completion_chunks(stream_request):
                if chunk:
                    full_response += chunk
                    formatted_chunk = chunk.replace("\n", "<br>")
                    yield f"data: {formatted_chunk}\n\n"

            stream_succeeded = True
            yield "event: close\ndata: Stream finished.\n\n"

        except asyncio.CancelledError:
            logger.warning(f"Stream cancelled by client for StreamId: {stream_id}")
        except Exception as ex:
            logger.error(f"Error during streaming for StreamId: {stream_id}: {str(ex)}")
            yield f"event: error\ndata: {{\"message\": \"Er is een serverfout opgetreden tijdens het streamen.\"}}\n\n"

        finally:
            if stream_succeeded and full_response and context:
                chat_service.update_history_after_stream(context['session_id'], full_response)
                logger.info(f"History updated after successful stream for SessionId: {context['session_id']}")

            logger.info(f"Finished processing SSE GET request for StreamId: {stream_id}")

    return Response(event_stream(), mimetype='text/event-stream')
