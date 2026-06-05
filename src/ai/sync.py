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
        ratio /= 0.5

    filters.append(f"atempo={ratio}")

    return ",".join(filters)


def stretch_audio(input_path: str, output_path: str, target_duration: float):
    tts_duration = get_duration(input_path)

    if tts_duration <= 0:
        raise ValueError("Empty audio")

    ratio = target_duration / tts_duration
    atempo = build_atempo(ratio)

    # стретч
    stretched_tmp = input_path.replace(".wav", "_tmp.wav")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", input_path,
        "-af", atempo,
        stretched_tmp
    ], check=True)

    # hard trim/pad до точної тривалості
    subprocess.run([
        "ffmpeg", "-y",
        "-i", stretched_tmp,
        "-af", (
            f"apad=whole_dur={target_duration},"
            f"atrim=end={target_duration},"
            f"asetpts=PTS-STARTPTS"
        ),
        output_path
    ], check=True)

    os.remove(stretched_tmp)
    return output_path