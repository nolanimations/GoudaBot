import pytest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from Services.chat_service import chat_service, ChatService, ChatSession, SessionManager

@pytest.fixture
# This creates a fake request and is not connected to OpenAI
def mock_request():
    return {
        "session_id": "Voorbeeldtest123",
        "message": "Hallo, wat zijn de activiteiten vandaag in Gouda?",
        "custom_instructions": "Wees formeel en zakelijk."
    }

def test_ensure_thread_creates_new():
    session = ChatSession()
    assert session.thread_id is None

    fake_thread = MagicMock()
    fake_thread.id = "Test om te kijken of de thread inderdaad wordt toegevoegd"

    with patch("openai.beta.threads.create", return_value=fake_thread):
        thread_id = ChatService()._ensure_thread(session)

    assert thread_id == "Test om te kijken of de thread inderdaad wordt toegevoegd"
    assert session.thread_id == "Test om te kijken of de thread inderdaad wordt toegevoegd"

def test_ensure_thread_returns_existing():
    session = ChatSession()
    session.thread_id = "Kijken of de thread uberhaupt bestaat"
    thread_id = ChatService()._ensure_thread(session)

    assert thread_id == "Kijken of de thread uberhaupt bestaat"

def test_stream_chat_completion_chunks(mock_request):
    session = ChatSession()
    SessionManager._sessions.clear()
    SessionManager.save_session("Voorbeeldtest123", session)

    mock_thread = MagicMock()
    mock_thread.id = "thread_abc"

    mock_event = MagicMock()
    mock_event.event = "thread.message.delta"
    mock_event.data.delta.content = [MagicMock(type="text", text=MagicMock(value="Dit is puur voor testen"))]

    mock_run = [mock_event]

    # create just returns the thread
    # runs.create returns the fake output
    with patch("openai.beta.threads.create", return_value=mock_thread), \
         patch("openai.beta.threads.messages.create"), \
         patch("openai.beta.threads.runs.create", return_value=mock_run):

        generator, _ = chat_service.stream_chat_completion_chunks(mock_request) # Function that splits the text into chunks

        chunks = list(generator) # Converts it back into a list
        assert chunks == ["Dit is puur voor testen"]

        updated_session = SessionManager.get_or_create_session("Voorbeeldtest123")
        assert len(updated_session.history) == 2
        assert updated_session.history[0]["role"] == "user"
        assert updated_session.history[1]["role"] == "assistant"
        assert updated_session.history[1]["content"].startswith("Dit")

def test_trim_history_removes_old_entries():
    session = ChatSession()
    session.history = [{"role": "user", "content": f"bericht {i}"} for i in range(60)]

    ChatService._trim_history(session, max_items=40)
    assert len(session.history) == 40
    assert session.history[0]["content"]