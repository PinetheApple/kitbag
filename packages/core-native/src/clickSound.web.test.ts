import { expect, it } from 'vitest';

import {
  clearCustomSound,
  customSoundLoaded,
  loadCustomSound,
  prepareClickSound,
} from './clickSound.web.ts';

it('has no custom click sounds on web', async () => {
  await expect(prepareClickSound('file:///a.wav', 'a.wav')).rejects.toThrow(
    /Android/,
  );
  await expect(loadCustomSound(0, 'a.wav')).rejects.toThrow(/Android/);
  expect(() => {
    clearCustomSound(0);
  }).not.toThrow();
  await expect(customSoundLoaded(0)).resolves.toBe(false);
});
