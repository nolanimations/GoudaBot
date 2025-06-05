from typing import List, Dict

class ChatSession:
    def __init__(self, custom_instructions):
        self.custom_instructions = custom_instructions
        self.history: List[Dict[str, str]] = []  # Each message: {"role": ..., "content": ...}

class SessionManager:
    sessions = {}
