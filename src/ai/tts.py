import azure.cognitiveservices.speech as speechsdk
import asyncio
import os

async def text_to_speech(text: str) -> bytes:
    def _synthesize():
        config = speechsdk.SpeechConfig(
            subscription=os.getenv("AZURE_SPEECH_KEY"),
            region=os.getenv("AZURE_SPEECH_REGION")
        )
        config.speech_synthesis_voice_name = "uk-UA-OstapNeural"

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=config,
            audio_config=None
        )

        result = synthesizer.speak_text_async(text).get()

        if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(result.cancellation_details.error_details)

        return result.audio_data

    return await asyncio.to_thread(_synthesize)