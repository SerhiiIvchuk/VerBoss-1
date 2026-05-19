from gradio_client import Client

client = Client("patriotyk/styletts2-ukrainian")

async def Verbalize(texts: str):
    result = client.predict(
        text=texts,
        api_name="/verbalize"
    )
    return result

async def TextToSpeech(texts: str):
    result = client.predict(
        model_name="multi",
        text=texts,
        speed=1,
        voice_name="Артем Окороков",
        api_name="/synthesize"
    )
    return result
