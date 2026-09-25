import { Chip, ChipRow } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { muteChipValue, rampChipValue } from '../logic/trainer.ts';
import { MuteBarsSheet } from './MuteBarsSheet.tsx';
import { RampSheet } from './RampSheet.tsx';

type OpenSheet = 'none' | 'ramp' | 'muteBars';

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

function useOpenSheet() {
  const [open, setOpen] = useState<OpenSheet>('none');
  const openRamp = useCallback(() => {
    setOpen('ramp');
  }, []);
  const openMuteBars = useCallback(() => {
    setOpen('muteBars');
  }, []);
  const close = useCallback(() => {
    setOpen('none');
  }, []);
  return { open, openRamp, openMuteBars, close };
}

export function TrainerChips({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const { open, openRamp, openMuteBars, close } = useOpenSheet();
  return (
    <>
      <ChipRow>
        <RampChip onPress={openRamp} />
        <MuteChip onPress={openMuteBars} />
      </ChipRow>
      <RampSheet
        visible={open === 'ramp'}
        bottomInset={bottomInset}
        onDismiss={close}
      />
      <MuteBarsSheet
        visible={open === 'muteBars'}
        bottomInset={bottomInset}
        onDismiss={close}
      />
    </>
  );
}
