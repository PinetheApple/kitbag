import type { StepperKeys } from '@kitbag/core-design';
import type { BeatDirection } from '@kitbag/core-state';

export const EARLIER: BeatDirection = -1;
export const LATER: BeatDirection = 1;

export const NUDGE_KEYS: StepperKeys = {
  earlier: 'decrease',
  later: 'increase',
  earlierLabel: 'Nudge the click earlier',
  laterLabel: 'Nudge the click later',
};

export const DOWNBEAT_KEYS: StepperKeys = {
  earlier: 'back',
  later: 'forward',
  earlierLabel: 'Downbeat one beat back',
  laterLabel: 'Downbeat one beat forward',
};
