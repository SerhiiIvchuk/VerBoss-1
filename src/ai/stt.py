import tempfile
import asyncio
import os
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from groq import Groq

from ai.trasnlate import Translate
from ai.tts import text_to_speech
from ai.sync import get_duration, stretch_audio

API_KEY = os.getenv("API_TOKEN")
client = Groq(api_key=API_KEY)

router = APIRouter()


async def transcribe_async(path: str):
    def _run():
        with open(path, "rb") as f:
            r = client.audio.transcriptions.create(
                file=f,
                model="whisper-large-v3",
                language="en"
            )
        return r.text

    return await asyncio.to_thread(_run)


@router.websocket("/ws/stt")
async def websocket_stt(ws: WebSocket):
    await ws.accept()

    tmp = None
    path = None
    segment_start = None
    segment_end = None

    try:
        while True:
            message = await ws.receive()

            if "text" in message:
                text_data = message["text"]

                try:
                    parsed = json.loads(text_data)
                    if parsed.get("type") == "START":
                        segment_start = float(parsed["start"])
                        segment_end = float(parsed["end"])
                        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
                        path = tmp.name

                except json.JSONDecodeError:
                    if text_data == "END":
                        if not tmp or not path:
                            continue

                        tmp.close()

                        tts_path = None
                        synced_path = None

                        try:
                            if not os.path.exists(path):
                                raise ValueError("Input file missing")

                            if segment_start is None or segment_end is None:
                                raise ValueError("No segment timestamps received")

                            target_duration = segment_end - segment_start

                            text = await transcribe_async(path)
                            if not text:
                                raise ValueError("Empty transcription")

                            translated = await Translate(text)
                            if not translated:
                                raise ValueError("Empty translation")

                            audio = await text_to_speech(translated)
                            if not audio or len(audio) < 100:
                                raise ValueError("Invalid TTS audio")

                            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tts_tmp:
                                tts_path = tts_tmp.name
                                tts_tmp.write(audio)
                                tts_tmp.flush()
                                os.fsync(tts_tmp.fileno())

                            synced_path = tts_path.replace(".wav", "_synced.wav")
                            stretch_audio(tts_path, synced_path, target_duration)

                            with open(synced_path, "rb") as f:
                                while chunk := f.read(64 * 1024):
                                    await ws.send_bytes(chunk)

                            await ws.send_json({"status": "done"})

                        except Exception as e:
                            print("Error:", e)
                            await ws.send_json({"error": str(e)})

                        finally:
                            for p in [path, tts_path, synced_path]:
                                if p and os.path.exists(p):
                                    try:
                                        os.remove(p)
                                    except:
                                        pass

                            tmp = None
                            path = None
                            segment_start = None
                            segment_end = None

            elif "bytes" in message:
                if tmp:
                    tmp.write(message["bytes"])

    except WebSocketDisconnect:
        pass

    finally:
        if tmp:
            try:
                tmp.close()
            except:
                pass
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except:
                pass