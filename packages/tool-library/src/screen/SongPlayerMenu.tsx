import {
  isOverridden,
  MenuRow,
  meterCopy,
  MeterRow,
  Sheet,
  type MeterGridState,
} from '@kitbag/core-design';
import {
  useSongLibrary,
  useSongPlayer,
  type StemPlayerStatus,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import { lockBadgeOf } from '../logic/lockText.ts';
import { canReanalyze } from '../logic/notices.ts';
import { METER_FAILED, meterGridState } from '../logic/songMeterText.ts';
import { PLAYER_MENU_TEXT, REANALYZE_LABEL } from '../logic/viewText.ts';
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
const UNPLAYABLE: ReadonlySet<StemPlayerStatus> = new Set([
  'failed',
  'missing',
]);

function meterRowState(
  status: StemPlayerStatus,
  grid: MeterGridState,
): MeterGridState {
  if (status === 'ready') return grid;
  return UNPLAYABLE.has(status) ? 'failed' : 'pending';
}

function SongMeterRow({ onPress }: { readonly onPress: () => void }) {
  const override = useSongPlayer((s) => s.meterOverride);
  const detected = useSongPlayer((s) => s.detected.meter);
  const status = useSongPlayer((s) => s.status);
  const grid = meterGridState(useSongPlayer(lockBadgeOf));
  const state = meterRowState(status, grid);
  return (
    <MeterRow
      value={override.meterBeatsPerBar ?? detected}
      yours={isOverridden(override)}
      disabled={state !== 'ready'}
      reason={state === 'failed' ? METER_FAILED : meterCopy.pending}
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
