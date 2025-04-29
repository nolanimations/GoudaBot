from fastapi import APIRouter
from Models.ChatRequest import ChatRequest
from openai import *

chatController = APIRouter()

class StreamContext:
    def __init__(self, session_id: str, user_message: str, custom_instructions: str = None):
        self.session_id = session_id
        self.user_message = user_message
        self.custom_instructions = custom_instructions



@chatController.post("initiate")
async def initiate_chatStream(request: ChatRequest): 
    print("initiate")



@chatController.get("/stream/{stream_id}")
async def get_chat_stream(stream_id: str):
    print("WIP!")