import openai
from threading import Lock

# In-memory session manager (thread-safe)
class SessionManager:
    _sessions = {}
    _lock = Lock()

    @classmethod
    def get_or_create_session(cls, session_id, custom_instructions=None):
        with cls._lock:
            if session_id not in cls._sessions:
                cls._sessions[session_id] = ChatSession(custom_instructions)
            return cls._sessions[session_id]

    @classmethod
    def save_session(cls, session_id, session):
        with cls._lock:
            cls._sessions[session_id] = session

class ChatSession:
    def __init__(self, custom_instructions=None):
        self.custom_instructions = custom_instructions or (
            "Je bent een behulpzame AI-assistent gespecialiseerd in activiteiten en revalidatiemogelijkheden in Gouda, Nederland. Reageer vriendelijk en informatief."
        )
        self.history = []

class ChatService:
    def __init__(self, openai_api_key):
        openai.api_key = openai_api_key

    async def stream_chat_completion_chunks_async(self, request):
        # Session management
        session = SessionManager.get_or_create_session(request['session_id'], request.get('custom_instructions'))
        effective_instructions = request.get('custom_instructions') or session.custom_instructions

        # Add user message to history
        session.history.append({"role": "user", "content": request['message']})

        # Prepare messages for OpenAI
        messages = [{"role": "system", "content": effective_instructions}] + session.history

        # Streaming OpenAI response
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1024,
            stream=True,
        )

        # Yield chunks as they arrive
        async def chunk_generator():
            async for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices[0].delta else ""
                if delta:
                    yield delta

        return chunk_generator(), session

    def update_history_after_stream(self, session_id, full_assistant_response):
        session = SessionManager.get_or_create_session(session_id)
        if not full_assistant_response:
            return

        # Prevent duplicate assistant messages
        if not session.history or session.history[-1]["role"] != "assistant" or session.history[-1]["content"] != full_assistant_response:
            session.history.append({"role": "assistant", "content": full_assistant_response})

            # Trim history if needed (keep last 20 messages)
            max_history_items = 20
            if len(session.history) > max_history_items:
                items_to_remove = len(session.history) - max_history_items
                # Remove oldest messages, keep at least one pair
                items_to_remove = max(0, min(items_to_remove, len(session.history) - 2))
                if items_to_remove > 0:
                    session.history = session.history[items_to_remove:]

        SessionManager.save_session(session_id, session)

# Singleton instance for import in controller
import os
chat_service = ChatService(openai_api_key=os.environ.get("OPENAI_API_KEY", "sk-..."))