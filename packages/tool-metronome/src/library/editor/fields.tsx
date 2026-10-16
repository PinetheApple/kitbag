import {
  SegmentedControl,
  StepControl,
  type SegmentOption,
  type StepDelta,
} from '@kitbag/core-design';
import { useCallback } from 'react';

import type { DraftUpdate } from './usePresetEditor.ts';
import type { PresetDraft } from '../../logic/presetDraft.ts';

type NumberKey = 'bpm' | 'subdivision' | 'polyBeats';

export interface StepFieldProps {
  readonly update: DraftUpdate;
  readonly field: NumberKey;
  readonly value: number;
  readonly label: string;
  readonly display?: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
}

export function StepField(props: StepFieldProps) {
  const { update, field, min, max } = props;
  const step = useCallback(
    (delta: StepDelta) => {
      update((d) => ({
        ...d,
        [field]: Math.min(Math.max(d[field] + delta, min), max),
      }));
    },
    [update, field, min, max],
  );
  return (
    <StepControl
      variant="inline"
      label={props.label}
      value={props.display ?? String(props.value)}
      accessibilityValue={`${String(props.value)} ${props.unit}`}
      onStep={step}
    />
  );
}

type Trainers = Pick<PresetDraft, 'ramp' | 'barMute'>;

export interface TrainerStepProps<K extends keyof Trainers> {
  readonly update: DraftUpdate;
  readonly trainer: K;
  readonly value: number;
  readonly label: string;
  readonly unit: string;
  readonly step: (trainer: Trainers[K], delta: StepDelta) => Trainers[K];
}

export function TrainerStep<K extends keyof Trainers>(
  props: TrainerStepProps<K>,
) {
  const { update, trainer, step } = props;
  const onStep = useCallback(
    (delta: StepDelta) => {
      update((d) => ({ ...d, [trainer]: step(d[trainer], delta) }));
    },
    [update, trainer, step],
  );
  return (
    <StepControl
      variant="inline"
      label={props.label}
      value={String(props.value)}
      accessibilityValue={`${String(props.value)} ${props.unit}`}
      onStep={onStep}
    />
  );
}

const ON_OFF: readonly SegmentOption<'off' | 'on'>[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
];

export function OnOff({
  on,
  label,
  onChange,
}: {
  readonly on: boolean;
  readonly label: string;
  readonly onChange: (on: boolean) => void;
}) {
  const select = useCallback(
    (value: 'off' | 'on') => {
      onChange(value === 'on');
    },
    [onChange],
  );
  return (
    <SegmentedControl
      compact
      accessibilityLabel={label}
      options={ON_OFF}
      selected={on ? 'on' : 'off'}
      onSelect={select}
    />
  );
}
