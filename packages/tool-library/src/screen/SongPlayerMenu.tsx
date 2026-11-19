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
import {
  TEMPO_CORRECTION_COPY,
  tempoCorrectionValue,
} from '../logic/tempoCorrectionText.ts';
import { PLAYER_MENU_TEXT, REANALYZE_LABEL } from '../logic/viewText.ts';
import { useSongFailure } from './rowFailureHooks.ts';

interface SongPlayerMenuProps {
  readonly songId: number;
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onBack: () => void;
  readonly onMeter: () => void;
  readonly onTempoCorrection: () => void;
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

interface RowProps {
  readonly onPress: () => void;
}

function useGridRowState(): MeterGridState {
  const status = useSongPlayer((s) => s.status);
  const grid = meterGridState(useSongPlayer(lockBadgeOf));
  return meterRowState(status, grid);
}

const gridRowReason = (state: MeterGridState) =>
  state === 'failed' ? METER_FAILED : meterCopy.pending;

function SongMeterRow({ onPress }: RowProps) {
  const override = useSongPlayer((s) => s.meterOverride);
  const detected = useSongPlayer((s) => s.detected.meter);
  const state = useGridRowState();
  return (
    <MeterRow
      value={override.meterBeatsPerBar ?? detected}
      yours={isOverridden(override)}
      disabled={state !== 'ready'}
      reason={gridRowReason(state)}
      onPress={onPress}
    />
  );
}

function TempoCorrectionRow({ onPress }: RowProps) {
  const correction = useSongPlayer((s) => s.tempoCorrection);
  const detectedBpm = useSongPlayer((s) => s.detectedBpm);
  const state = useGridRowState();
  const disabled = state !== 'ready';
  const value = tempoCorrectionValue(correction, detectedBpm);
  return (
    <MenuRow
      icon="tempoCorrection"
      label={TEMPO_CORRECTION_COPY.title}
      detail={disabled ? gridRowReason(state) : undefined}
      value={disabled ? undefined : value.shown}
      spokenValue={disabled ? undefined : value.spoken}
      disabled={disabled}
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
  onTempoCorrection,
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
  const openTempoCorrection = useCallback(() => {
    onDismiss();
    onTempoCorrection();
  }, [onDismiss, onTempoCorrection]);
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
      <TempoCorrectionRow onPress={openTempoCorrection} />
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
