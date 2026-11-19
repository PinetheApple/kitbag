import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import type {
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
  playing: true,
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
