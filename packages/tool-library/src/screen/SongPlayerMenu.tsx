import {
  isOverridden,
  MenuRow,
  METER_PENDING,
  MeterRow,
  Sheet,
} from '@kitbag/core-design';
import { useSongLibrary, useSongPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';

import { lockBadgeOf } from '../logic/lockText.ts';
import { canReanalyze } from '../logic/notices.ts';
import {
  METER_FAILED,
  meterGridState,
  PLAYER_MENU_TEXT,
} from '../logic/songMeterText.ts';
import { REANALYZE_LABEL } from '../logic/viewText.ts';
import { useSongFailure } from './useSongFailure.ts';

interface SongPlayerMenuProps {
  readonly songId: number;
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onBack: () => void;
  readonly onMeter: () => void;
}

const doNothing = () => undefined;

function SongMeterRow({ onPress }: { readonly onPress: () => void }) {
  const override = useSongPlayer((s) => s.meterOverride);
  const detected = useSongPlayer((s) => s.detected.meter);
  const ready = useSongPlayer((s) => s.status === 'ready');
  const grid = meterGridState(useSongPlayer(lockBadgeOf));
  const state = ready ? grid : 'pending';
  return (
    <MeterRow
      value={override.meterBeatsPerBar ?? detected}
      yours={isOverridden(override)}
      disabled={state !== 'ready'}
      reason={state === 'failed' ? METER_FAILED : METER_PENDING}
      onPress={onPress}
    />
  );
}

export function SongPlayerMenu({
  songId,
  visible,
  bottomInset,
  onDismiss,
  onBack,
  onMeter,
}: SongPlayerMenuProps) {
  const close = useSongPlayer((s) => s.close);
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const reanalyzable = canReanalyze(useSongFailure(songId));
  const stop = useCallback(() => {
    onDismiss();
    onBack();
    close();
  }, [onDismiss, onBack, close]);
  const onReanalyze = useCallback(() => {
    onDismiss();
    void reanalyze(songId);
  }, [onDismiss, reanalyze, songId]);
  const openMeter = useCallback(() => {
    onDismiss();
    onMeter();
  }, [onDismiss, onMeter]);
  return (
    <Sheet
      visible={visible}
      title={PLAYER_MENU_TEXT.title}
      dismissLabel={PLAYER_MENU_TEXT.dismiss}
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      {reanalyzable ? (
        <MenuRow
          icon="analyzing"
          label={REANALYZE_LABEL}
          detail={PLAYER_MENU_TEXT.reanalyzeDetail}
          onPress={onReanalyze}
        />
      ) : null}
      <SongMeterRow onPress={openMeter} />
      <MenuRow
        icon="countIn"
        label={PLAYER_MENU_TEXT.countIn}
        value={PLAYER_MENU_TEXT.countInValue}
        detail={PLAYER_MENU_TEXT.countInDetail}
        disabled
        onPress={doNothing}
      />
      <MenuRow
        icon="stop"
        label={PLAYER_MENU_TEXT.stop}
        detail={PLAYER_MENU_TEXT.stopDetail}
        onPress={stop}
      />
    </Sheet>
  );
}
