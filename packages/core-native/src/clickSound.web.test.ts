import { expect, it } from 'vitest';

import {
  clearCustomSound,
  customSoundLoaded,
  deleteClickSound,
  listClickSounds,
  loadCustomSound,
  prepareClickSound,
  readClickSound,
  writeClickSound,
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
  await expect(readClickSound('a.wav')).rejects.toThrow(/Android/);
  await expect(writeClickSound('a.wav', 'AA==')).rejects.toThrow(/Android/);
  await expect(deleteClickSound('a.wav')).rejects.toThrow(/Android/);
  await expect(listClickSounds()).resolves.toEqual([]);
});
