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

type TrainerKey = 'ramp' | 'barMute';
type TrainerPart = 'a' | 'b' | 'bars';

export interface TrainerStepProps {
  readonly update: DraftUpdate;
  readonly trainer: TrainerKey;
  readonly part: TrainerPart;
  readonly draft: PresetDraft;
  readonly label: string;
  readonly unit: string;
  readonly max: number;
  readonly min: number;
}

export function TrainerStep(props: TrainerStepProps) {
  const { update, trainer, part, min, max } = props;
  const value = props.draft[trainer][part];
  const step = useCallback(
    (delta: StepDelta) => {
      update((d) => {
        const next = Math.min(Math.max(d[trainer][part] + delta, min), max);
        return { ...d, [trainer]: { ...d[trainer], [part]: next } };
      });
    },
    [update, trainer, part, min, max],
  );
  return (
    <StepControl
      variant="inline"
      label={props.label}
      value={String(value)}
      accessibilityValue={`${String(value)} ${props.unit}`}
      onStep={step}
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
