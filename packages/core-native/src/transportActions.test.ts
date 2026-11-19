import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { TRANSPORT_ACTIONS, transportActionNamed } from './transportActions';

const transportModel = join(
  import.meta.dirname,
  '../android/src/main/java/com/kitbag/corenative/transport/TransportModel.kt',
);

it('names exactly the service actions, as the module lowercases them', () => {
  const source = readFileSync(transportModel, 'utf8');
  const body = /enum class TransportAction \{([^;]*);/.exec(source)?.[1] ?? '';
  const declared = body
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  expect(declared).toEqual([...TRANSPORT_ACTIONS]);
});

it('reads a known name and refuses an unknown one', () => {
  expect(transportActionNamed('pause')).toBe('pause');
  expect(transportActionNamed('rewind')).toBeUndefined();
  expect(transportActionNamed('PAUSE')).toBeUndefined();
});
