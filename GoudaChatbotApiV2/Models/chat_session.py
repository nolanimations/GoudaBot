from typing import List, Dict

class ChatSession:
    def __init__(self, custom_instructions: str = "Je bent een behulpzame AI-assistent gespecialiseerd in activiteiten en revalidatiemogelijkheden in Gouda, Nederland. Reageer vriendelijk en informatief."):
        self.custom_instructions = custom_instructions
        self.history: List[Dict[str, str]] = []  # Each message: {"role": ..., "content": ...}