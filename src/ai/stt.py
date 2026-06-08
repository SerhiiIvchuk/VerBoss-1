import tempfile
import asyncio
import os
import json
import base64
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

    try:
        while True:
            message = await ws.receive()

            if "text" not in message:
                continue

            try:
                payload = json.loads(message["text"])
            except json.JSONDecodeError:
                await ws.send_json({"error": "Invalid JSON"})
                continue

            if payload.get("type") != "AUDIO_CHUNK_SUBMIT":
                continue

            meta = payload.get("meta", {})
            prefs = payload.get("userPreferences", {})
            audio_b64 = payload.get("audioData", "")

            chunk_id = meta.get("chunkId")
            start_time = float(meta.get("startTime", 0))
            end_time = float(meta.get("endTime", 0))
            target_duration = end_time - start_time
            target_lang = prefs.get("targetLanguage", "uk")
            enable_translation = prefs.get("enableTranslation", True)

            try:
                audio_bytes = base64.b64decode(audio_b64)
            except Exception:
                await ws.send_json({"chunkId": chunk_id, "error": "Invalid base64 audio"})
                continue

            input_path = None
            tts_path = None
            synced_path = None

            try:
                if len(audio_bytes) < 100:
                    raise ValueError("Audio too short")

                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(audio_bytes)
                    input_path = tmp.name

                text = await transcribe_async(input_path)
                ws.send_text("Transcribing...")
                if not text:
                    raise ValueError("Empty transcription")

                translated = text
                if enable_translation:
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

                generated_duration = get_duration(synced_path)

                with open(synced_path, "rb") as f:
                    synced_b64 = base64.b64encode(f.read()).decode()

                await ws.send_json({
                    "type": "TRANSCRIPTION_RESULT",
                    "target": "subtitles",
                    "meta": {
                        "videoId": meta.get("videoId"),
                        "chunkId": chunk_id,
                        "sequenceToken": meta.get("sequenceToken"),
                        "startTime": start_time,
                        "endTime": end_time,
                    },
                    "text": translated,
                })
                
                await ws.send_json({
                    "type": "TRANSCRIPTION_RESULT",
                    "target": "content",
                    "meta": {
                        "videoId": meta.get("videoId"),
                        "chunkId": chunk_id,
                        "sequenceToken": meta.get("sequenceToken"),
                        "startTime": start_time,
                        "endTime": end_time,
                        "originalDuration": target_duration,
                        "generatedDuration": round(generated_duration, 3),
                        "playbackSpeedFactor": round(generated_duration / target_duration, 3),
                    },
                    "aiProfile": {
                        "stt": "whisper-large-v3",
                        "translator": "GoogleTranslator",
                        "tts": "Microsoft-Azure",
                        "voiceName": "default",
                        "language": target_lang,
                    },
                    "audio": {
                        "mimeType": "audio/wav",
                        "sampleRate": 24000,
                        "audioData": synced_b64,
                    },
                    "text": translated,
                })

            except Exception as e:
                print(f"[chunk {chunk_id}] Error: {e}")
                await ws.send_json({
                    "type": "CHUNK_ERROR",
                    "chunkId": chunk_id,
                    "error": str(e)
                })

            finally:
                for p in [input_path, tts_path, synced_path]:
                    if p and os.path.exists(p):
                        try:
                            os.remove(p)
                        except:
                            pass

    except WebSocketDisconnect:
        pass