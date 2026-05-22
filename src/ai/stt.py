from concurrent.futures import ThreadPoolExecutor

from faster_whisper import WhisperModel

import tempfile
import asyncio
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ai.trasnlate import Translate
from ai.tts import Verbalize, TextToSpeech

model = WhisperModel(
    "small.en",
    device="cpu",
    compute_type="int8"
)

executor = ThreadPoolExecutor(max_workers=2)

router = APIRouter()

def transcribe_sync(path: str):
    segments, info = model.transcribe(
        path,
        beam_size=2,
        vad_filter=True
    )
    
    text = " ".join(seg.text for seg in segments)

    return {
        "text": text,
        "language": info.language,
        "duration": info.duration
    }

async def transcribe_async(path: str):
    loop = asyncio.get_event_loop()

    return await loop.run_in_executor(
        executor,
        lambda: transcribe_sync(path)
    )


@router.websocket("/ws/stt")
async def websocket_stt(ws: WebSocket):
    await ws.accept()

    tmp = None
    path = None

    try:
        while True:
            try:
                message = await ws.receive()
            except RuntimeError:
                break
            
            if "text" in message:
                if message["text"] == "START":
                    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
                    path = tmp.name

                if message["text"] == "END":
                    if tmp is None:
                        continue
                    tmp.close()
                    print(f"Transcribing {path}...")
                    try:
                        result = await transcribe_async(path)
                        print("2")
                        translated = await Translate(result["text"])
                        print("3")
                        verbalized_text = await Verbalize(translated)
                        texttospeech = await TextToSpeech(verbalized_text)
                        await ws.send_bytes(texttospeech)
                    except Exception as e:
                        print(f"Error: {e}")
                    finally:
                        tmp = None
                        path = None

                    continue
            elif "bytes" in message:
                if tmp:
                    tmp.write(message["bytes"])
                    tmp.flush()

    except WebSocketDisconnect:
        if tmp:
            tmp.close()

    finally:
        try:
            if path is not None and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
