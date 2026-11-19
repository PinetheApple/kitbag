import { expect, it } from 'vitest';

import { KB_MIXDOWN_STATE } from './generated/nativeConstants.gen.ts';
import {
  mixdownProgress,
  mixdownStart,
  mixdownState,
  shareExport,
} from './mixdown.web.ts';

it('has no mixdown on web', async () => {
  expect(mixdownState()).toBe(KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_IDLE);
  expect(mixdownProgress()).toBe(0);
  await expect(mixdownStart('Song.wav')).rejects.toThrow(/Android/);
  await expect(shareExport('/x.wav')).rejects.toThrow(/Android/);
});
