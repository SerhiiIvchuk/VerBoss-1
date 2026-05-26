import azure.cognitiveservices.speech as speechsdk

speech_config = speechsdk.SpeechConfig(
    subscription="YourSpeechResourceKey",
    region="eastus"
)

# Вказати голос (для української мови)
speech_config.speech_synthesis_voice_name = "uk-UA-PolinaNeural"

# Вивести у файл
audio_config = speechsdk.audio.AudioOutputConfig(filename="output.wav")

synthesizer = speechsdk.SpeechSynthesizer(
    speech_config=speech_config,
    audio_config=audio_config
)

result = synthesizer.speak_text_async("Привіт, це тест!").get()

if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
    print("Успішно!")
elif result.reason == speechsdk.ResultReason.Canceled:
    print(f"Помилка: {result.cancellation_details.error_details}")