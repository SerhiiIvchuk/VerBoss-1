from concurrent.futures import ThreadPoolExecutor
from faster_whisper import WhisperModel
import tempfile
import asyncio
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# Ініціалізація моделі
model = WhisperModel(
    "small",
    # "tiny",
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
    
    text = " ".join(seg.text for seg in segments).strip()
    
    return {
        "text": text,
        "language": info.language
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

            # NEW: Транскрибуємо пакет відразу (не чекаючи __end__)
            result = await transcribe_async(tmp_path)

            # NEW: Видаляємо тимчасовий файл після обробки
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

            # NEW: Відправляємо результат, якщо Whisper щось почув
            if result["text"]:
                print(f"[{result['language']}]: {result['text']}")
                await ws.send_json(result)

    except WebSocketDisconnect:
        print("--- [WS] Disconnected ---") # NEW
    except Exception as e: # NEW
        print(f"--- [WS] Error: {e} ---") # NEW