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

import { countInOptionLabel } from '../logic/clickChipText.ts';
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
  readonly onCountIn: () => void;
}
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

function useGridGatedRow() {
  const state = useGridRowState();
  const disabled = state !== 'ready';
  return { disabled, detail: disabled ? gridRowReason(state) : undefined };
}

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
  const { disabled, detail } = useGridGatedRow();
  const value = tempoCorrectionValue(correction, detectedBpm);
  return (
    <MenuRow
      icon="tempoCorrection"
      label={TEMPO_CORRECTION_COPY.title}
      detail={detail}
      value={disabled ? undefined : value.shown}
      spokenValue={disabled ? undefined : value.spoken}
      disabled={disabled}
      onPress={onPress}
    />
  );
}

function CountInRow({ onPress }: RowProps) {
  const bars = useSongPlayer((s) => s.clickSettings.countInBars);
  const { disabled, detail } = useGridGatedRow();
  return (
    <MenuRow
      icon="countIn"
      label={PLAYER_MENU_TEXT.countIn}
      detail={detail}
      value={disabled ? undefined : countInOptionLabel(bars)}
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
  onCountIn,
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
  const openCountIn = useCallback(() => {
    onDismiss();
    onCountIn();
  }, [onDismiss, onCountIn]);
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
      <CountInRow onPress={openCountIn} />
      <MenuRow
        icon="stop"
        label={PLAYER_MENU_TEXT.stop}
        detail={PLAYER_MENU_TEXT.stopDetail}
        onPress={stop}
      />
    </Sheet>
  );
}
