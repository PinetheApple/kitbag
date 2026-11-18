import math
import struct
import sys
import wave

SAMPLE_RATE = 44100
BPM = 120
CLICK_HZ = 1000
CLICK_SECONDS = 0.02
AMPLITUDE = 0.5
SAMPLE_FORMAT = '<h'
SAMPLE_BYTES = struct.calcsize(SAMPLE_FORMAT)
FULL_SCALE = 2 ** (8 * SAMPLE_BYTES - 1) - 1
SECONDS_PER_MINUTE = 60


def one_beat() -> bytes:
    beat_frames = SAMPLE_RATE * SECONDS_PER_MINUTE // BPM
    click_frames = int(SAMPLE_RATE * CLICK_SECONDS)
    levels = [
        AMPLITUDE * math.sin(2 * math.pi * CLICK_HZ * t / SAMPLE_RATE)
        if t < click_frames
        else 0.0
        for t in range(beat_frames)
    ]
    return b''.join(struct.pack(SAMPLE_FORMAT, int(level * FULL_SCALE)) for level in levels)


def main() -> None:
    path, seconds = sys.argv[1], int(sys.argv[2])
    beats = seconds * BPM // SECONDS_PER_MINUTE
    with wave.open(path, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(SAMPLE_BYTES)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(one_beat() * beats)


if __name__ == '__main__':
    main()
