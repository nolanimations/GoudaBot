class ChatRequest:
    def __init__(self, session_id: str, message: str, custom_instructions: str = None):
        self.session_id = session_id
        self.message = message
        self.custom_instructions = custom_instructions
