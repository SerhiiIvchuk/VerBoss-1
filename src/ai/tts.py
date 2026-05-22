from gradio_client import Client
import asyncio

client = Client("patriotyk/styletts2-ukrainian")

async def Verbalize(texts: str):
    result = client.predict(
        text=texts,
        api_name="/verbalize"
    )
    return result

async def TextToSpeech(texts: str):
    loop = asyncio.get_event_loop()
    
    path = await loop.run_in_executor(None, lambda: client.predict(
        model_name="multi",
        text=texts,
        speed=1,
        voice_name="Артем Окороков",
        api_name="/synthesize"
    ))
    
    with open(path, "rb") as f:
        return f.read()
