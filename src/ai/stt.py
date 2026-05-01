import whisper
import tempfile
import os
from fastapi import APIRouter, UploadFile, File

model = whisper.load_model("medium")

router = APIRouter()

@router.post("/transcribe")
async def stt(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        path = tmp.name

    result = model.transcribe(path, language="uk", task="transcribe")

    os.remove(path)

    return {
        "text": result["text"],
        "segments": result.get("segments", []),
        "language": result.get("language")
    }