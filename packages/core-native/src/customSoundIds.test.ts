import { expect, it } from 'vitest';

import {
  KB_CUSTOM_SOUND_SLOTS,
  KB_SOUND_NAMES,
} from './generated/nativeConstants.gen.ts';
import {
  customSoundId,
  isCustomSoundId,
  isCustomSoundSlot,
} from './customSoundIds.ts';

const SLOTS = Array.from({ length: KB_CUSTOM_SOUND_SLOTS }, (_, slot) => slot);

it('numbers the custom slots straight after the built-in sounds', () => {
  expect(SLOTS.map(customSoundId)).toEqual(
    SLOTS.map((slot) => KB_SOUND_NAMES.length + slot),
  );
});

it('accepts exactly the engine slot range', () => {
  expect(SLOTS.every(isCustomSoundSlot)).toBe(true);
  expect(isCustomSoundSlot(-1)).toBe(false);
  expect(isCustomSoundSlot(KB_CUSTOM_SOUND_SLOTS)).toBe(false);
  expect(isCustomSoundSlot(0.5)).toBe(false);
});

it('tells custom ids from built-in ones', () => {
  expect(SLOTS.map(customSoundId).every(isCustomSoundId)).toBe(true);
  expect(isCustomSoundId(KB_SOUND_NAMES.length - 1)).toBe(false);
  expect(isCustomSoundId(customSoundId(KB_CUSTOM_SOUND_SLOTS))).toBe(false);
});
