from concurrent.futures import ThreadPoolExecutor
from faster_whisper import WhisperModel
import tempfile
import asyncio
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect



model = WhisperModel(
    "small",
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

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    path = tmp.name
    try:
        while True:
            data = await ws.receive_bytes()

            # !!! Тут потрібно щоб фронт надсилав __start__ і __end__ для того щоб ШІ розуміла !!!
            
            
            if data == b"__end__":

                text = await transcribe_async(path)

                await ws.send_json(text)

                await ws.close()
                tmp.close()
                break

            tmp.write(data)
            tmp.flush()
    except WebSocketDisconnect:
        pass


    finally:
        if os.path.exists(path):
            os.remove(path)