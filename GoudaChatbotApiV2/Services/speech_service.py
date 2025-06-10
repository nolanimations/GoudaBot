import openai

def transcribe_audio(audio_file):
    response = openai.audio.speech(
        model="whisper-1",
        file=audio_file
    )
    return response['text']