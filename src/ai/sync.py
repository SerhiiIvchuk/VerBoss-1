import asyncio
import subprocess
import os

def get_duration(path: str) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path
        ],
        capture_output=True,
        text=True
    )

    value = result.stdout.strip()

    if not value or value == "N/A":
        raise RuntimeError(f"Invalid audio: {path}")

    return float(value)


def build_atempo(ratio: float) -> str:
    filters = []

    while ratio > 2.0:
        filters.append("atempo=2.0")
        ratio /= 2.0

    while ratio < 0.5:
        filters.append("atempo=0.5")
        ratio *= 2.0

    filters.append(f"atempo={ratio}")

    return ",".join(filters)


def stretch_audio(input_path: str, output_path: str, target_duration: float):
    tts_duration = get_duration(input_path)

    if tts_duration <= 0:
        raise ValueError("Empty audio")

    ratio = target_duration / tts_duration

    # Стискаємо/розтягуємо мову лише в м'якому діапазоні (0.7x - 1.5x),
    # щоб не спотворювати голос
    safe_ratio = max(0.7, min(1.5, ratio))

    stretched_tmp = input_path.replace(".wav", "_tmp.wav")

    if abs(safe_ratio - 1.0) > 0.01:
        atempo = build_atempo(safe_ratio)
        subprocess.run([
            "ffmpeg", "-y",
            "-i", input_path,
            "-af", atempo,
            stretched_tmp
        ], check=True)
    else:
        stretched_tmp = input_path  # без змін

    # Доповнюємо тишею в кінці або обрізаємо, без зміни темпу мови
    subprocess.run([
        "ffmpeg", "-y",
        "-i", stretched_tmp,
        "-af", "apad",
        "-t", f"{target_duration:.6f}",
        output_path
    ], check=True)

    if stretched_tmp != input_path:
        os.remove(stretched_tmp)

    return output_path