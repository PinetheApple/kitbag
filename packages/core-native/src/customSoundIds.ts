import {
  KB_CUSTOM_SOUND_SLOTS,
  KB_SOUND_NAMES,
} from './generated/nativeConstants.gen.ts';

const FIRST_CUSTOM_SOUND_ID = KB_SOUND_NAMES.length;

export function isCustomSoundSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < KB_CUSTOM_SOUND_SLOTS;
}

export function customSoundId(slot: number): number {
  return FIRST_CUSTOM_SOUND_ID + slot;
}

export function isCustomSoundId(id: number): boolean {
  return isCustomSoundSlot(id - FIRST_CUSTOM_SOUND_ID);
}
