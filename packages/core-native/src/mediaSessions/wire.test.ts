import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import type {
  MediaSessionsEvent,
  MediaSessionWire,
} from '../NativeKitbagMediaSessions';

const moduleSource = readFileSync(
  join(
    import.meta.dirname,
    '../../android/src/main/java/com/kitbag/corenative/KitbagMediaSessionsModule.kt',
  ),
  'utf8',
);

const sessionKeys = Object.keys({
  sessionId: true,
  packageName: true,
  appLabel: true,
  title: true,
  artist: true,
  durationMs: true,
  playing: true,
  positionMs: true,
  positionUpdatedAtMs: true,
  speed: true,
} satisfies Record<keyof MediaSessionWire, true>);

const eventKeys = Object.keys({
  sessions: true,
} satisfies Record<keyof MediaSessionsEvent, true>);

function keysIn(start: string): string[] {
  const from = moduleSource.indexOf(start);
  const body = moduleSource.slice(from, moduleSource.indexOf('\n  }\n', from));
  return [
    ...new Set([...body.matchAll(/put\w+\("(\w+)"/g)].map((m) => m[1] ?? '')),
  ];
}

it('the module emits exactly the session fields', () => {
  expect(keysIn('private fun MediaSessionInfo.toMap').sort()).toEqual(
    [...sessionKeys].sort(),
  );
});

it('the module emits exactly the event fields', () => {
  expect(keysIn('private fun emitSessions').sort()).toEqual(
    [...eventKeys].sort(),
  );
});
