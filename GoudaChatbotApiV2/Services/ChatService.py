# services/chat_service.py

import os
import logging
from typing import AsyncGenerator
from openai import AsyncOpenAI
from Models.ChatSession import SessionManager, ChatSession
from Models.ChatRequest import ChatRequest

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API Key is missing or invalid.")

        self.client = AsyncOpenAI(api_key=api_key)

    async def stream_chat_completion_chunks(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        session = SessionManager.sessions.setdefault(request.session_id, ChatSession())

        effective_instructions = request.custom_instructions or session.custom_instructions

        session.history.append({"role": "user", "content": request.message})

        messages = [{"role": "system", "content": effective_instructions}] + session.history.copy()

        logger.info(f"Sending request to OpenAI for SessionId: {request.session_id}")

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                stream=True,
                max_tokens=1024
            )

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

            logger.info(f"Finished streaming chunks for SessionId: {request.session_id}")
        except Exception as e:
            logger.error(f"Error during OpenAI stream: {str(e)}")
            raise

    def update_history_after_stream(self, session_id: str, full_response: str):
        if not full_response:
            return

        session = SessionManager.sessions.get(session_id)
        if not session:
            logger.warning(f"Attempted to update history for non-existent SessionId: {session_id}")
            return

        if not (session.history and session.history[-1]["role"] == "assistant" and session.history[-1]["content"] == full_response):
            session.history.append({"role": "assistant", "content": full_response})
            logger.info(f"Assistant response added to history for SessionId: {session_id}")

            max_history_items = 20
            if len(session.history) > max_history_items:
                excess = len(session.history) - max_history_items
                session.history = session.history[excess:]
