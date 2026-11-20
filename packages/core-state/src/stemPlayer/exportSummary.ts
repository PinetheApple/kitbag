import {
  KB_MIXDOWN_BITS_PER_SAMPLE,
  KB_MIXDOWN_CHANNELS,
} from '@kitbag/core-native';

import { mixdownFileName } from './mixdownFileName.ts';
import type { StemPlayerCommands } from './runtime.ts';
import type { StemPlayerState } from './store.ts';

const BITS_PER_BYTE = 8;
const WAV_HEADER_BYTES = 44;

export interface ExportSummary {
  readonly speed: number;
  readonly key: number | null;
  readonly stems: number;
  readonly muted: number;
  readonly soloed: number;
  readonly loopSet: boolean;
  readonly lengthSec: number;
  readonly sampleRate: number;
  readonly bytes: number;
  readonly fileName: string;
}

export type SummarySource = Pick<
  StemPlayerState,
  'title' | 'artist' | 'stems' | 'loop' | 'engineRate' | 'durationFrames'
>;

type SummaryCommands = Pick<
  StemPlayerCommands,
  'mixerRate' | 'mixerTrackPitch'
>;

export function wavBytes(lengthSec: number, sampleRate: number): number {
  const frameBytes =
    (KB_MIXDOWN_CHANNELS * KB_MIXDOWN_BITS_PER_SAMPLE) / BITS_PER_BYTE;
  return Math.round(lengthSec * sampleRate) * frameBytes + WAV_HEADER_BYTES;
}

function sharedKey(keys: readonly number[]): number | null {
  const [first = 0] = keys;
  return keys.every((key) => key === first) ? first : null;
}

export async function summarizeExport(
  source: SummarySource,
  commands: SummaryCommands,
  maxBaseNameBytes: number,
): Promise<ExportSummary> {
  const loaded = source.stems.flatMap((row, track) =>
    row.loaded ? [{ row, track }] : [],
  );
  const keyed = loaded.filter(({ row }) => row.transposable);
  const [speed, keys] = await Promise.all([
    commands.mixerRate(),
    Promise.all(keyed.map(({ track }) => commands.mixerTrackPitch(track))),
  ]);
  const key = sharedKey(keys);
  const lengthSec = source.durationFrames / source.engineRate / speed;
  return {
    speed,
    key,
    stems: loaded.length,
    muted: loaded.filter(({ row }) => row.muted).length,
    soloed: loaded.filter(({ row }) => row.soloed).length,
    loopSet: source.loop.kind === 'on',
    lengthSec,
    sampleRate: source.engineRate,
    bytes: wavBytes(lengthSec, source.engineRate),
    fileName: mixdownFileName(
      { title: source.title, artist: source.artist, speed, key },
      maxBaseNameBytes,
    ),
  };
}
