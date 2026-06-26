import json
import subprocess
from difflib import SequenceMatcher


def get_duration(path: str) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    return float(json.loads(result.stdout)["format"]["duration"])


def normalize(text: str) -> str:
    return (
        text.lower()
        .replace(",", "")
        .replace(".", "")
        .replace("!", "")
        .replace("?", "")
        .replace(":", "")
        .replace(";", "")
        .replace('"', "")
        .replace("'", "")
        .strip()
    )


def align_segments(original_segments, tts_segments):
    original = [normalize(x["text"]) for x in original_segments]
    generated = [normalize(x["text"]) for x in tts_segments]

    matcher = SequenceMatcher(None, original, generated)

    aligned = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():

        if tag == "equal":
            for o, t in zip(
                original_segments[i1:i2],
                tts_segments[j1:j2],
            ):
                aligned.append((o, t))

        elif tag == "replace":
            count = min(i2 - i1, j2 - j1)

            for k in range(count):
                aligned.append(
                    (
                        original_segments[i1 + k],
                        tts_segments[j1 + k],
                    )
                )

    return aligned


def build_timemap(
    original_segments,
    tts_segments,
    sample_rate: int,
    output_file: str,
):
    aligned = align_segments(
        original_segments,
        tts_segments,
    )

    with open(output_file, "w") as f:

        f.write("0 0\n")

        for original, tts in aligned:

            f.write(
                f"{int(tts['start'] * sample_rate)} "
                f"{int(original['start'] * sample_rate)}\n"
            )

            f.write(
                f"{int(tts['end'] * sample_rate)} "
                f"{int(original['end'] * sample_rate)}\n"
            )

        tts_duration = tts_segments[-1]["end"]
        original_duration = original_segments[-1]["end"]

        f.write(
            f"{int(tts_duration * sample_rate)} "
            f"{int(original_duration * sample_rate)}\n"
        )


def stretch_audio(
    input_path: str,
    output_path: str,
    target_duration: float,
    timemap: str | None = None,
):
    cmd = [
        "rubberband",
        "--fine",
        "--duration",
        str(target_duration),
    ]

    if timemap:
        cmd.extend(
            [
                "--timemap",
                timemap,
            ]
        )

    cmd.extend(
        [
            input_path,
            output_path,
        ]
    )

    subprocess.run(
        cmd,
        check=True,
    )