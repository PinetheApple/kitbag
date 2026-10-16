import { Chip, ChipRow } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { countInActive, countInLabel } from '../logic/countIn.ts';
import { soundChipLabel, soundLabel } from '../logic/soundChoice.ts';
import { muteChipValue, rampChipValue } from '../logic/trainer.ts';
import { CountInSheet } from './CountInSheet.tsx';
import { MuteBarsSheet } from './MuteBarsSheet.tsx';
import { RampSheet } from './RampSheet.tsx';
import { SoundSheet } from './SoundSheet.tsx';

type OpenSheet = 'none' | 'ramp' | 'muteBars' | 'sound' | 'countIn';

function RampChip({ onPress }: { readonly onPress: () => void }) {
  const ramp = useMetronome((s) => s.ramp);
  const range = `${String(ramp.startBpm)} to ${String(ramp.endBpm)} BPM`;
  return (
    <Chip
      icon="ramp"
      active={ramp.enabled}
      label={ramp.enabled ? rampChipValue(ramp.startBpm, ramp.endBpm) : 'Ramp'}
      accessibilityLabel={
        ramp.enabled ? `Tempo ramp, ${range}` : 'Tempo ramp, off'
      }
      onPress={onPress}
    />
  );
}

function MuteChip({ onPress }: { readonly onPress: () => void }) {
  const { enabled, playBars, muteBars } = useMetronome((s) => s.barMute);
  const cycle = `play ${String(playBars)}, mute ${String(muteBars)}`;
  return (
    <Chip
      icon="muteBars"
      active={enabled}
      label={enabled ? muteChipValue(playBars, muteBars) : 'Mute bars'}
      accessibilityLabel={enabled ? `Mute bars, ${cycle}` : 'Mute bars, off'}
      onPress={onPress}
    />
  );
}
function SoundChip({ onPress }: { readonly onPress: () => void }) {
  const sounds = useMetronome((s) => s.sounds);
  const label = soundChipLabel(sounds);
  return (
    <Chip
      icon="sound"
      label={label}
      accessibilityLabel={`Click sound, normal ${soundLabel(sounds.normal)}, accent ${soundLabel(sounds.accent)}`}
      onPress={onPress}
    />
  );
}

function CountInChip({ onPress }: { readonly onPress: () => void }) {
  const bars = useMetronome((s) => s.countIn.bars);
  const active = countInActive(bars);
  return (
    <Chip
      icon="countIn"
      active={active}
      label={active ? countInLabel(bars) : 'Count-in'}
      accessibilityLabel={`Count-in, ${countInLabel(bars)}`}
      onPress={onPress}
    />
  );
}

function useOpenSheet() {
  const [open, setOpen] = useState<OpenSheet>('none');
  const opener = useCallback(
    (sheet: OpenSheet) => () => {
      setOpen(sheet);
    },
    [],
  );
  return { open, opener };
}

interface SheetsProps {
  readonly open: OpenSheet;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

function TrainerSheets({ open, bottomInset, onDismiss }: SheetsProps) {
  const shared = { bottomInset, onDismiss };
  return (
    <>
      <RampSheet visible={open === 'ramp'} {...shared} />
      <MuteBarsSheet visible={open === 'muteBars'} {...shared} />
      <SoundSheet visible={open === 'sound'} {...shared} />
      <CountInSheet visible={open === 'countIn'} {...shared} />
    </>
  );
}

export function TrainerChips({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const { open, opener } = useOpenSheet();
  return (
    <>
      <ChipRow>
        <RampChip onPress={opener('ramp')} />
        <MuteChip onPress={opener('muteBars')} />
        <SoundChip onPress={opener('sound')} />
        <CountInChip onPress={opener('countIn')} />
      </ChipRow>
      <TrainerSheets
        open={open}
        bottomInset={bottomInset}
        onDismiss={opener('none')}
      />
    </>
  );
}
