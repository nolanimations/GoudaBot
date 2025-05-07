import os
import openai
from dotenv import load_dotenv
from threading import Lock
from flask import current_app

# ---------------------------------------------------------------------------
# 0. Global configuration (dotenv + OpenAI key)
# ---------------------------------------------------------------------------
# Load environment and set API key globally once
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY") or ""

# ---------------------------------------------------------------------------
# 1. Helper to create/reuse an Assistant wired to the Vector Store
# ---------------------------------------------------------------------------
_ASSISTANT_CACHE_FILE = ".assistant_id"
_VECTOR_ID = os.getenv("VECTOR_STORE_ID")

def _get_or_create_assistant() -> str:
    """Ensure an assistant exists with file_search tool connected to the vector store, and return its ID."""
    # Use cached assistant ID if available
    if os.path.exists(_ASSISTANT_CACHE_FILE):
        with open(_ASSISTANT_CACHE_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    if not _VECTOR_ID:
        raise RuntimeError("VECTOR_STORE_ID not found in environment.")

    # Create a new assistant with file_search tool enabled and linked to the vector store
    assistant = openai.beta.assistants.create(
        name="Gouda Activity Bot",
        instructions=(
            "Je bent een behulpzame AI‑assistent gespecialiseerd in activiteiten en "
            "revalidatiemogelijkheden in Gouda, Nederland. Reageer vriendelijk en "
            "informatief. Geef in je antwoord website‑links mee als je naar een instantie refereert. Geef de namen van de data-bestanden NIET mee in je antwoord."
        ),
        model="gpt-4o",
        tools=[{"type": "file_search"}],
        tool_resources={"file_search": {"vector_store_ids": [_VECTOR_ID]}}
    )
    # Cache the assistant ID for reuse
    with open(_ASSISTANT_CACHE_FILE, "w", encoding="utf-8") as f:
        f.write(assistant.id)
    return assistant.id

# Initialize the assistant (create if not exists)
_ASSISTANT_ID = _get_or_create_assistant()

# ---------------------------------------------------------------------------
# 2. Session models
# ---------------------------------------------------------------------------
class SessionManager:
    """Thread-safe in-memory storage for per-user ChatSession objects."""
    _sessions: dict[str, "ChatSession"] = {}
    _lock: Lock = Lock()

    @classmethod
    def get_or_create_session(cls, session_id: str, custom_instructions: str | None = None):
        with cls._lock:
            if session_id not in cls._sessions:
                cls._sessions[session_id] = ChatSession(custom_instructions)
            return cls._sessions[session_id]

    @classmethod
    def save_session(cls, session_id: str, session: "ChatSession"):
        with cls._lock:
            cls._sessions[session_id] = session

class ChatSession:
    """Keeps track of custom instructions, local history, and the OpenAI thread ID."""
    def __init__(self, custom_instructions: str | None = None):
        self.custom_instructions: str = custom_instructions or (
            "Je bent een behulpzame AI-assistent gespecialiseerd in activiteiten en "
            "revalidatiemogelijkheden in Gouda, Nederland. Reageer vriendelijk en "
            "informatief. Geef in je antwoord ook website links mee als je naar een instantie refereert. "
            "Geef alleen de rauwe data terug zoals je het krijgt."
        )
        self.history: list[dict] = []      # local log of messages (optional, not sent to API)
        self.thread_id: str | None = None  # OpenAI Thread ID for this session

# ---------------------------------------------------------------------------
# 3. ChatService
# ---------------------------------------------------------------------------
class ChatService:
    """Facade used by the Flask controller to stream assistant responses in chunks."""
    def __init__(self, openai_api_key: str | None = None):
        # Optionally override the global API key (if provided)
        if openai_api_key:
            openai.api_key = openai_api_key

    # Internal helper: ensure a thread exists for the session, create if not
    def _ensure_thread(self, session: ChatSession) -> str:
        if session.thread_id:
            return session.thread_id
        # Create a new (empty) thread for this session
        thread = openai.beta.threads.create()
        session.thread_id = thread.id
        return thread.id

    # Internal helper: trim local history to a maximum length
    @staticmethod
    def _trim_history(session: ChatSession, max_items: int = 40):
        if len(session.history) > max_items:
            session.history = session.history[-max_items:]

    # Public method: handle a new user message and stream the assistant's response
    def stream_chat_completion_chunks(self, request: dict):
        """Processes a user message and returns a generator yielding the response in text chunks."""
        # 1. Retrieve or initialize the chat session and update custom instructions if provided
        session = SessionManager.get_or_create_session(
            request['session_id'], request.get('custom_instructions')
        )
        if request.get('custom_instructions'):
            session.custom_instructions = request['custom_instructions']

        # 2. Ensure a conversation thread exists for this session, then post the user message to it
        thread_id = self._ensure_thread(session)
        user_message = request['message']
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )
        session.history.append({"role": "user", "content": user_message})

        # 3. Run the assistant on the thread (the assistant will use file_search automatically if needed)
        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=_ASSISTANT_ID,
            instructions=session.custom_instructions,
            stream=True
        )


        # 4. Stream the response chunks back to the client, and record the full assistant reply
        def chunk_generator():
            full_parts: list[str] = []

            for event in run:
                if event.event == "thread.message.delta":
                    # event.data.delta.content is a list → extract the text value(s)
                    pieces = []
                    for block in event.data.delta.content or []:
                        if getattr(block, "type", None) == "text":
                            pieces.append(block.text.value)
                    chunk_text = "".join(pieces)

                    if chunk_text:
                        full_parts.append(chunk_text)
                        yield chunk_text

            # after stream completes, log the assistant answer
            full_text = "".join(full_parts).strip()
            if full_text:
                session.history.append({"role": "assistant", "content": full_text})
                self._trim_history(session)
                SessionManager.save_session(request["session_id"], session)

        return chunk_generator(), None

    # (Optional) Backwards-compatibility method for updating history after stream – not needed now
    def update_history_after_stream(self, session_id: str, full_assistant_response: str | None):
        pass  # History is already updated within stream_chat_completion_chunks

# 4. Singleton instance (for use in the Flask controller)
chat_service = ChatService(openai_api_key=os.getenv("OPENAI_API_KEY"))
