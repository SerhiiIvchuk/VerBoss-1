import tempfile
import asyncio
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from groq import Groq

API_KEY = os.getenv("API_TOKEN")

client = Groq(api_key=API_KEY)

router = APIRouter()

async def transcribe_async(path: str):
    def _transcribe():
        with open(path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                file=f,
                model="whisper-large-v3",
                language="en"
            )
        return {"text": transcription.text}

    return await asyncio.to_thread(_transcribe)


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

                    try:
                        text = await transcribe_async(path)
                        await ws.send_json(text)
                    except Exception as e:
                        print(f"Error: {e}")
                        await ws.send_json({"error": str(e)})
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