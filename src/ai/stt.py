from concurrent.futures import ThreadPoolExecutor
import whisper
import tempfile
import asyncio
import os
from fastapi import APIRouter, UploadFile, File

model = whisper.load_model("medium")

executor = ThreadPoolExecutor(max_workers=3)

router = APIRouter()

def transcribe_sync(path: str):
    return model.transcribe(
        path,
        language=None,
        condition_on_previous_text=True
    )

async def transcribe_async(path: str):
    loop = asyncio.get_event_loop()

    return await loop.run_in_executor(
        executor,
        lambda: transcribe_sync(path)
    )

@router.post("/transcribe")
async def stt(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        path = tmp.name
        try:
            while chunk := await file.read(1024 * 1024):
                tmp.write(chunk)
            
            tmp.close()
        
            result = await transcribe_async(path)
            
            return {"result": result}
        finally:
            os.remove(path)
            print(type(result))