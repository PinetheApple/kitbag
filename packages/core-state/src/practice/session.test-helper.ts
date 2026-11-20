import { loggedSettingsOf, type LoggedSettings } from '@kitbag/core-db';

import { presetFromMetronome } from '../library/presetMapping.ts';
import { initialConfig } from '../metronome/store.ts';
import type {
  PracticeContext,
  PracticeSong,
  PracticeStage,
} from './session.ts';
import type { StretchSetup } from './stretch.ts';

export const MINUTE = 60_000;
export const SECOND = 1000;
export const FRIDAY = { id: 7, name: 'Friday' };
export const OPENER = { uuid: 'opener', title: 'Opener' };
export const CLOSER = { uuid: 'closer', title: 'Closer' };
export const NOTHING: PracticeContext = { setlist: null, song: null };

export function setupWith(edit: Partial<LoggedSettings> = {}): StretchSetup {
  const settings = loggedSettingsOf(presetFromMetronome(initialConfig()));
  return {
    settings: { ...settings, ...edit },
    countIn: { bars: 0, distinct: false, sound: 0 },
  };
}

export const SETUP = setupWith();

export function stageAt(position: number): PracticeStage {
  return { ...FRIDAY, uuid: 'friday', position, itemId: position };
}

export function onStage(
  song: PracticeSong | null,
  position = song === CLOSER ? 2 : 1,
): PracticeContext {
  return { setlist: stageAt(position), song };
}
