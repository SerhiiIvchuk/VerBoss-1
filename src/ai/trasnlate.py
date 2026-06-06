from deep_translator import GoogleTranslator
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

async def Translate(text: str):
    loop = asyncio.get_event_loop()
    translator = GoogleTranslator(source="auto", target="uk")
    return await loop.run_in_executor(executor, translator.translate, text)