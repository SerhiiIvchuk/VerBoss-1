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
    
    # Створюємо тимчасовий файл для накопичення аудіо
    # tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    # path = tmp.name
    print("--- [WS] Connected ---") # NEW: Для відстеження підключення
    # try:
    #     while True:
    #         data = await ws.receive_bytes()

    #         # Якщо отримано сигнал завершення, обробляємо весь файл
    #         if data == b"__end__":
    #             text_result = await transcribe_async(path)
    #             await ws.send_json(text_result)
    #             await ws.close()
    #             tmp.close()
    #             break

    #         # Записуємо чанки даних у файл
    #         tmp.write(data)
    #         tmp.flush()
            
    # except WebSocketDisconnect:
    #     pass
    # finally:
    #     # Обов'язково видаляємо файл після завершення або обриву з'єднання
    #     if os.path.exists(path):
    #         os.remove(path)
    try:
        while True:
            # NEW: Отримуємо 5-секундний WAV-файл від фронта
            data = await ws.receive_bytes() 

            if not data: # NEW
                continue # NEW

            # === ПОЧАТОК БЛОКУ ДЛЯ ПЕРЕВІРКИ ЗВУКУ ===
            # Цей код збереже останній отриманий шматок звуку у файл debug_audio.wav
            # Ви зможете знайти його всередині контейнера
            with open("debug_audio.wav", "wb") as f:
                f.write(data)
            print(f"DEBUG: Пакет {len(data)} байт збережено в debug_audio.wav")
            # === КІНЕЦЬ БЛОКУ ===
            
            # NEW: Створюємо тимчасовий файл для кожного окремого пакета
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
        print("--- [WS] Disconnected ---") # NEW
    except Exception as e: # NEW
        print(f"--- [WS] Error: {e} ---") # NEW