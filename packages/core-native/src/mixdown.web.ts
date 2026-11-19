import { KB_MIXDOWN_STATE } from './generated/nativeConstants.gen.ts';
import type * as Native from './mixdown.ts';

const NEEDS_APP = 'Exporting a mix needs the Android app';

export const mixdownStart: typeof Native.mixdownStart = () =>
  Promise.reject(new Error(NEEDS_APP));

export const mixdownCancel: typeof Native.mixdownCancel = () => undefined;

export const shareExport: typeof Native.shareExport = () =>
  Promise.reject(new Error(NEEDS_APP));

export const mixdownProgress: typeof Native.mixdownProgress = () => 0;

export const mixdownState: typeof Native.mixdownState = () =>
  KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_IDLE;
