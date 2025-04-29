from flask import Blueprint, request, jsonify, Response, current_app

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
    # Store in cache (Flask-Caching)
    cache.set(stream_id, context)
    return jsonify({"streamId": stream_id})

@chat_controller.route('/stream/<stream_id>', methods=['GET'])
def get_chat_stream(stream_id):
    cache = current_app.cache
    from Services.chat_service import SessionManager
    from Services.chat_service import chat_service

    # Retrieve from cache
    context = cache.get(stream_id)
    if not context:
        return jsonify({"detail": "Invalid or expired stream ID."}), 404

    def event_stream():
        try:
            # Get or create a chat session (implement this in your chat_service)
            session = SessionManager.get_or_create_session(context.session_id, context.custom_instructions)
            # Add the user's message to history
            session.history.append({"role": "user", "content": context.user_message})

            # Prepare messages for OpenAI
            messages = [{"role": "system", "content": session.custom_instructions}] + session.history

            import openai
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                stream=True,
            )

            full_response = ""
            for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices[0].delta else ""
                if delta:
                    full_response += delta
                    formatted_chunk = delta.replace("\n", "<br>")
                    yield f"data: {formatted_chunk}\n\n"
            # Add assistant's response to history
            session.history.append({"role": "assistant", "content": full_response})
            SessionManager.save_session(context.session_id, session)
            yield "event: close\ndata: Stream finished.\n\n"
        except Exception as ex:
            print("Streaming error:", ex, flush=True)
            yield f"event: error\ndata: {str(ex)}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")