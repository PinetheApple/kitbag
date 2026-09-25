import { Chip, ChipRow } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { muteChipValue, rampChipValue } from '../logic/trainer.ts';
import { MuteBarsSheet } from './MuteBarsSheet.tsx';
import { RampSheet } from './RampSheet.tsx';

type OpenSheet = 'none' | 'ramp' | 'muteBars';

interface TrainerChipsProps {
  readonly bottomInset: number;
}

export function TrainerChips({ bottomInset }: TrainerChipsProps) {
  const ramp = useMetronome((s) => s.ramp);
  const barMute = useMetronome((s) => s.barMute);
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

  const rampValue = rampChipValue(ramp.startBpm, ramp.endBpm);
  const muteValue = muteChipValue(barMute.playBars, barMute.muteBars);

  return (
    <>
      <ChipRow>
        <Chip
          icon="ramp"
          active={ramp.enabled}
          label={ramp.enabled ? rampValue : 'Ramp'}
          accessibilityLabel={
            ramp.enabled ? `Tempo ramp, ${rampValue} BPM` : 'Tempo ramp, off'
          }
          onPress={openRamp}
        />
        <Chip
          icon="muteBars"
          active={barMute.enabled}
          label={barMute.enabled ? muteValue : 'Mute bars'}
          accessibilityLabel={
            barMute.enabled ? `Mute bars, ${muteValue}` : 'Mute bars, off'
          }
          onPress={openMuteBars}
        />
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
