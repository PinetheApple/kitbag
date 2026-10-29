export type RampBpmField = 'startBpm' | 'targetBpm';

export interface RampBpms {
  readonly startBpm: number;
  readonly targetBpm: number;
}

export const RAMP_BPM_ENTRY: Readonly<
  Record<RampBpmField, { readonly title: string; readonly confirm: string }>
> = {
  startBpm: { title: 'Ramp from', confirm: 'Set ramp start' },
  targetBpm: { title: 'Ramp to', confirm: 'Set ramp target' },
};

export function withRampBpm<T extends RampBpms>(
  ramp: T,
  field: RampBpmField,
  bpm: number,
): T {
  return { ...ramp, [field]: bpm };
}
