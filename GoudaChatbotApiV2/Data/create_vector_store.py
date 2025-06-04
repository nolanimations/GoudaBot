import os, openai
from dotenv import load_dotenv

load_dotenv()      
openai.api_key = os.getenv("OPENAI_API_KEY")

# -- new, stable namespace ----------------------------------
store = openai.vector_stores.create(name="gouda-bot-store")

# attach your three text files
files = ["alle_organisaties.txt",
         "events.txt",
         "ingouda_onderwerpen.txt"]

for path in files:
    f = openai.files.create(purpose="assistants", file=open(path, "rb"))
    openai.vector_stores.files.create(
        vector_store_id=store.id,
        file_id=f.id
    )

print("Vector Store ID:", store.id)
