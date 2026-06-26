import tempfile
import asyncio
import os
import json
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from groq import Groq

from ai.trasnlate import Translate_Ua_To_En, Translate_En_To_Ua
from ai.tts import tts2, ua_to_en
from ai.sync import (
    get_duration,
    stretch_audio,
    build_timemap,
)

API_KEY = os.getenv("API_TOKEN")
client = Groq(api_key=API_KEY)

router = APIRouter()

SAMPLE_RATE = 48000


async def transcribe_async(path: str, language: str = "uk"):
    def _run():
        with open(path, "rb") as f:
            return client.audio.transcriptions.create(
                file=f,
                model="whisper-large-v3",
                response_format="verbose_json",
                language=language,
            )

    result = await asyncio.to_thread(_run)

    print("=== FULL TEXT ===")
    print(result.text)

    print("=== SEGMENTS ===")
    for seg in result.segments:
        print(
            f"[{seg['start']:.2f} - {seg['end']:.2f}] "
            f"{seg['text']}"
        )

    return result
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

            target_lang = prefs.get("targetLanguage")
            enable_subtitles = prefs.get("enableSubtitles")
            enable_translation = prefs.get(
                "enableTranslation",
                True,
            )

            try:
                audio_bytes = base64.b64decode(audio_b64)
            except Exception:
                await ws.send_json({
                    "chunkId": chunk_id,
                    "error": "Invalid base64 audio"
                })
                continue

            input_path = None
            tts_path = None
            synced_path = None
            timemap_path = None

            try:

                if len(audio_bytes) < 100:
                    raise ValueError("Audio too short")

                with tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=".wav",
                ) as tmp:
                    tmp.write(audio_bytes)
                    input_path = tmp.name

                source_lang = (
                    "uk"
                    if target_lang == "en"
                    else "en"
                )

                stt_result = await transcribe_async(
                    input_path,
                    source_lang,
                )

                text = stt_result.text
                original_segments = stt_result.segments

                if not text:
                    raise ValueError(
                        "Empty transcription"
                    )

                translated = text

                if enable_translation:

                    if target_lang == "uk":
                        translated = await Translate_En_To_Ua(text)

                    elif target_lang == "en":
                        translated = await Translate_Ua_To_En(text)

                    if not translated:
                        raise ValueError(
                            "Empty translation"
                        )

                if target_lang == "uk":
                    audio = await tts2(translated)

                elif target_lang == "en":
                    audio = await asyncio.to_thread(
                        ua_to_en,
                        translated,
                    )

                else:
                    raise ValueError(
                        f"Unsupported targetLanguage: {target_lang}"
                    )

                if not audio or len(audio) < 100:
                    raise ValueError("Invalid TTS audio")

                with tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=".wav",
                ) as tts_tmp:

                    tts_path = tts_tmp.name
                    tts_tmp.write(audio)
                    tts_tmp.flush()
                    os.fsync(tts_tmp.fileno())
                    tts_result = await transcribe_async(
                    tts_path,
                    target_lang,
                )

                tts_segments = tts_result.segments

                timemap_path = tts_path.replace(
                    ".wav",
                    "_timemap.txt",
                )

                build_timemap(
                    original_segments=original_segments,
                    tts_segments=tts_segments,
                    sample_rate=SAMPLE_RATE,
                    output_file=timemap_path,
                )

                synced_path = tts_path.replace(
                    ".wav",
                    "_synced.wav",
                )

                stretch_audio(
                    input_path=tts_path,
                    output_path=synced_path,
                    target_duration=target_duration,
                    timemap=timemap_path,
                )

                generated_duration = get_duration(
                    synced_path
                )

                with open(synced_path, "rb") as f:
                    synced_b64 = base64.b64encode(
                        f.read()
                    ).decode()
                    if enable_subtitles:
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
                            "org": text,
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
                        "generatedDuration": round(
                            generated_duration,
                            3,
                        ),
                        "playbackSpeedFactor": round(
                            generated_duration / target_duration,
                            3,
                        )
                        if target_duration > 0
                        else 1.0,
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
                        "sampleRate": SAMPLE_RATE,
                        "audioData": synced_b64,
                    },
                    "text": translated,
                    "org": text,
                })

            except Exception as e:
                print(f"[chunk {chunk_id}] Error: {e}")

                await ws.send_json({
                    "type": "CHUNK_ERROR",
                    "chunkId": chunk_id,
                    "error": str(e),
                })

            finally:

                for p in (
                    input_path,
                    tts_path,
                    synced_path,
                    timemap_path,
                ):
                    if p and os.path.exists(p):
                        try:
                            os.remove(p)
                        except Exception:
                            pass

    except WebSocketDisconnect:
        pass