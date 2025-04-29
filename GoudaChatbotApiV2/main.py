from fastapi import FastAPI
from Controllers.ChatController import chatController

class Main:
    def run(self):
        app = FastAPI()
        app.include_router(chatController, prefix="/api/chat")







if __name__ == "__main__":
    import uvicorn
    # Run the app on localhost:5227
    uvicorn.run("main:app", host="127.0.0.1", port=5227, reload=True)