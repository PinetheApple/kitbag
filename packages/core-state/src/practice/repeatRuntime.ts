import { presetFieldsOfLogged } from '@kitbag/core-db';

import { applyPreset } from '../library/presetMapping.ts';
import { metronomeStore } from '../metronome/store.ts';
import { configureRepeatOverlay } from './repeatOverlay.ts';

export function startRepeatRuntime(): void {
  configureRepeatOverlay((settings) => {
    applyPreset(presetFieldsOfLogged(settings), () =>
      metronomeStore.getState(),
    );
  });
}
