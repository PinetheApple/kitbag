import argparse
import functools
import json
import math
import struct
import zipfile
from pathlib import Path

SAMPLE_RATE = 22050
SAMPLE_RATE_CODE = 0b0110
SAMPLE_BITS = 16
SAMPLE_SIZE_CODE = 0b100
CHANNELS = 1
MONO_CODE = 0b0000
BLOCK_FRAMES = 4096
EXPLICIT_16_BIT_BLOCK_CODE = 0b0111
FIXED_BLOCKING_SYNC = 0xFFF8
VERBATIM_TYPE = 0b000001
NO_WASTED_BITS = 0
STREAMINFO_TYPE = 0
STREAMINFO_BYTES = 34
IS_LAST_BLOCK = 1
UNKNOWN = 0
RESERVED = 0
CRC8_POLY = 0x07
CRC16_POLY = 0x8005
CRC16_BITS = 16
UTF8_CONTINUATION = 0x80
UTF8_PAYLOAD_BITS = 6
UTF8_ONE_BYTE_LIMIT = 0x80
BYTE_BITS = 8
BYTE_MASK = 0xFF
FULL_SCALE = 2 ** (SAMPLE_BITS - 1) - 1
AMPLITUDE = 0.25
STEM_TONES_HZ = {'bass': 110, 'keys': 440}

BPM = 120
BEATS_PER_BAR = 4
SECONDS_PER_MINUTE = 60

BUNDLE_FORMAT = 'stemdeck-song-bundle'
BUNDLE_VERSION = 1
MANIFEST = 'manifest.json'
BEATS = 'beats.json'
STEMS_DIR = 'stems/'
STEM_EXTENSION = '.flac'


@functools.cache
def crc_table(poly: int, width: int) -> tuple[int, ...]:
    top = 1 << (width - 1)
    mask = (1 << width) - 1
    table = []
    for byte in range(1 << BYTE_BITS):
        value = byte << (width - BYTE_BITS)
        for _ in range(BYTE_BITS):
            value = ((value << 1) ^ poly) if value & top else value << 1
            value &= mask
        table.append(value)
    return tuple(table)


def crc(data: bytes, poly: int, width: int) -> int:
    table = crc_table(poly, width)
    shift = width - BYTE_BITS
    mask = (1 << width) - 1
    value = 0
    for byte in data:
        value = ((value << BYTE_BITS) & mask) ^ table[(value >> shift) ^ byte]
    return value


def lead_bits(length: int) -> int:
    return BYTE_BITS - 1 - length


def coded_number(number: int) -> bytes:
    if number < UTF8_ONE_BYTE_LIMIT:
        return bytes([number])
    tail = []
    while number >= 1 << lead_bits(len(tail) + 1):
        tail.insert(0, UTF8_CONTINUATION | (number & ((1 << UTF8_PAYLOAD_BITS) - 1)))
        number >>= UTF8_PAYLOAD_BITS
    lead = (BYTE_MASK << lead_bits(len(tail))) & BYTE_MASK
    return bytes([lead | number, *tail])


def packed(fields: list[tuple[int, int]]) -> bytes:
    value = 0
    width = 0
    for field, bits in fields:
        value = value << bits | field
        width += bits
    return value.to_bytes(width // BYTE_BITS, 'big')


def streaminfo(total_frames: int) -> bytes:
    return packed([
        (IS_LAST_BLOCK, 1),
        (STREAMINFO_TYPE, 7),
        (STREAMINFO_BYTES, 24),
        (BLOCK_FRAMES, 16),
        (BLOCK_FRAMES, 16),
        (UNKNOWN, 24),
        (UNKNOWN, 24),
        (SAMPLE_RATE, 20),
        (CHANNELS - 1, 3),
        (SAMPLE_BITS - 1, 5),
        (total_frames, 36),
        (UNKNOWN, 128),
    ])


def frame(number: int, samples: list[int]) -> bytes:
    header = packed([
        (FIXED_BLOCKING_SYNC, 16),
        (EXPLICIT_16_BIT_BLOCK_CODE, 4),
        (SAMPLE_RATE_CODE, 4),
        (MONO_CODE, 4),
        (SAMPLE_SIZE_CODE, 3),
        (RESERVED, 1),
    ])
    header += coded_number(number) + packed([(len(samples) - 1, 16)])
    header += packed([(crc(header, CRC8_POLY, BYTE_BITS), BYTE_BITS)])
    subframe_header = packed([(RESERVED, 1), (VERBATIM_TYPE, 6), (NO_WASTED_BITS, 1)])
    body = header + subframe_header + struct.pack(f'>{len(samples)}h', *samples)
    return body + packed([(crc(body, CRC16_POLY, CRC16_BITS), CRC16_BITS)])


def flac(tone_hz: int, total_frames: int) -> bytes:
    samples = [
        int(AMPLITUDE * FULL_SCALE * math.sin(2 * math.pi * tone_hz * t / SAMPLE_RATE))
        for t in range(total_frames)
    ]
    blocks = (samples[start:start + BLOCK_FRAMES] for start in range(0, total_frames, BLOCK_FRAMES))
    return b'fLaC' + streaminfo(total_frames) + b''.join(frame(i, block) for i, block in enumerate(blocks))


def stem_path(name: str) -> str:
    return f'{STEMS_DIR}{name}{STEM_EXTENSION}'


def beat_grid(seconds: int) -> dict:
    beat_seconds = SECONDS_PER_MINUTE / BPM
    beats = [i * beat_seconds for i in range(seconds * BPM // SECONDS_PER_MINUTE)]
    return {'bpm': BPM, 'beats': beats, 'bars': [{'beat': 0, 'beats_per_bar': BEATS_PER_BAR}]}


def main() -> None:
    parser = argparse.ArgumentParser(description='Writes a StemDeck song bundle zip of sine-tone stems.')
    parser.add_argument('path', type=Path, help='the zip to write; its name is the song title')
    parser.add_argument('seconds', type=int)
    parser.add_argument('--no-grid', action='store_true', help='leave out beats.json')
    args = parser.parse_args()
    title = args.path.stem
    total_frames = args.seconds * SAMPLE_RATE
    manifest = {
        'format': BUNDLE_FORMAT,
        'version': BUNDLE_VERSION,
        'job_id': f'e2e-{title}',
        'title': title,
        'duration_sec': args.seconds,
        'sample_rate': SAMPLE_RATE,
        'channels': CHANNELS,
        'stems': [
            {'name': name, 'file': stem_path(name), 'frames': total_frames}
            for name in STEM_TONES_HZ
        ],
    }
    with zipfile.ZipFile(args.path, 'w', zipfile.ZIP_STORED) as bundle:
        bundle.writestr(MANIFEST, json.dumps(manifest))
        if not args.no_grid:
            bundle.writestr(BEATS, json.dumps(beat_grid(args.seconds)))
        for name, tone_hz in STEM_TONES_HZ.items():
            bundle.writestr(stem_path(name), flac(tone_hz, total_frames))


if __name__ == '__main__':
    main()
