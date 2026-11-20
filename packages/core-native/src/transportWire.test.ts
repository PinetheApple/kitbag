import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { TRANSPORT_PLAYBACK } from './transportActions';
import type {
  SongTransportOrder,
  SongTransportRequest,
  SongTransportShowState,
  TransportEvent,
  TransportShowState,
} from './NativeKitbagCommands';

const moduleSource = readFileSync(
  join(
    import.meta.dirname,
    '../android/src/main/java/com/kitbag/corenative/KitbagCommandsModule.kt',
  ),
  'utf8',
);

const eventKeys = Object.keys({
  playback: true,
  bpm: true,
  rampRunning: true,
  practicePlayedMs: true,
  practiceStretchStartedAt: true,
  cardNumber: true,
  action: true,
  tempoStep: true,
  engineBpm: true,
} satisfies Record<keyof TransportEvent, true>);

const showKeys = Object.keys({
  playback: true,
  bpm: true,
  rampRunning: true,
  beatsPerBar: true,
  beatUnit: true,
  minBpm: true,
  maxBpm: true,
  practicePlayedMs: true,
  practiceStretchStartedAt: true,
  setlist: true,
  cardNumber: true,
} satisfies Record<keyof TransportShowState, true>);

const songShowKeys = Object.keys({
  playing: true,
  countingIn: true,
  title: true,
  artist: true,
  durationFrames: true,
  restartFromFrame: true,
  skipSeconds: true,
  session: true,
  followsPlayOrder: true,
} satisfies Record<keyof SongTransportShowState, true>);

const songRequestKeys = Object.keys({
  action: true,
  frame: true,
  shownSession: true,
} satisfies Record<keyof SongTransportRequest, true>);

const songOrderKeys = Object.keys({
  previous: true,
  next: true,
} satisfies Record<keyof SongTransportOrder, true>);

function keysIn(start: string, pattern: RegExp): string[] {
  const from = moduleSource.indexOf(start);
  const body = moduleSource.slice(from, moduleSource.indexOf('\n  }\n', from));
  return [...body.matchAll(pattern)].map((match) => match[1] ?? '');
}

it('the module emits exactly the transport event fields', () => {
  const emitted = keysIn('private fun emitTransport', /put\w+\("(\w+)"/g);
  expect(emitted.sort()).toEqual([...eventKeys].sort());
});

it('the module reads exactly the transport card fields', () => {
  const read = keysIn('override fun transportShow', /state\.get\w+\("(\w+)"/g);
  expect(read.sort()).toEqual([...showKeys].sort());
});

it('the module reads exactly the song card fields', () => {
  const read = keysIn(
    'override fun songTransportShow',
    /state\.get\w+\("(\w+)"/g,
  );
  expect(read.sort()).toEqual([...songShowKeys].sort());
});

it('the module emits exactly the song request fields', () => {
  const emitted = keysIn('private fun emitSongRequest', /put\w+\("(\w+)"/g);
  expect([...new Set(emitted)].sort()).toEqual([...songRequestKeys].sort());
});

it('the module reads exactly the play order fields', () => {
  const read = keysIn(
    'override fun songTransportOrder',
    /order\.get\w+\("(\w+)"/g,
  );
  expect(read.sort()).toEqual([...songOrderKeys].sort());
});

it('names playback as the Kotlin Playback entries do', () => {
  const modelSource = readFileSync(
    join(
      import.meta.dirname,
      '../android/src/main/java/com/kitbag/corenative/transport/TransportModel.kt',
    ),
    'utf8',
  );
  const entries = /enum class Playback \{([^;]+);/.exec(modelSource)?.[1] ?? '';
  const names = entries.split(',').map((entry) => entry.trim().toLowerCase());
  expect(names.sort()).toEqual(Object.values(TRANSPORT_PLAYBACK).sort());
});
