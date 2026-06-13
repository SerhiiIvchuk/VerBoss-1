from deep_translator import GoogleTranslator
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

async def Translate_En_To_Ua(text: str):
    loop = asyncio.get_event_loop()
    translator = GoogleTranslator(source="auto", target="uk")
    return await loop.run_in_executor(executor, translator.translate, text)

async def Translate_Ua_To_En(text: str):
    loop = asyncio.get_event_loop()
    translator = GoogleTranslator(source="auto", target="en")
    return await loop.run_in_executor(executor, translator.translate, text)