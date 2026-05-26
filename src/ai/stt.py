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
    
    print("--- [WS] Connected ---") 

    try:
        while True:
            
            data = await ws.receive_bytes()
             
            message = await ws.receive_text()
            if not data: 
                continue 
            

            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(data)
                tmp_path = tmp.name

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
        print("--- [WS] Disconnected ---")
    except Exception as e: 
        print(f"--- [WS] Error: {e} ---")