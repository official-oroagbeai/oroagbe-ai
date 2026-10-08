from fastapi import FastAPI, UploadFile, File
from datetime import datetime
import asyncio

app = FastAPI(title="OroAgbeAI Model Service")

@app.get("/health")
def health_check():
    """Confirms the Python service is running."""
    return {
        "status": "ok",
        "service": "oroagbe-model-service",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/asr")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Receives an audio file from Express and returns the Yoruba transcription.
    For this MVP milestone, we simulate the NCAIR1/Yoruba-ASR processing.
    """
    print(f"[FastAPI] Received audio file: {file.filename}")
    
    # Read the audio bytes (In production, this goes to the AI model)
    audio_bytes = await file.read()
    
    # Simulate the time it takes an AI model to process audio (1.5 seconds)
    await asyncio.sleep(1.5)
    
    # Return a mocked Yoruba transcript.
    mock_transcript = "Bawo ni oju ojo se ri loni?"
    
    return {"transcript": mock_transcript}