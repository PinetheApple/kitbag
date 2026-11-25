import {
  isOverridden,
  MenuRow,
  meterCopy,
  MeterRow,
  QUEUE_TEXT,
  Sheet,
  TempoModeRow,
  useQueueKeys,
  useQueueNotices,
  useQueuePresses,
  type MeterGridState,
  type Notice,
} from '@kitbag/core-design';
import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import {
  speedPercentText,
  tempoModeLabel,
  tempoUnavailable,
  useIsQueued,
  useLiveSongPlayer,
  useQueueRefresh,
  useQueueSong,
  useSongLibrary,
  useSongPlayer,
  useSongViewing,
  VIEW_ONLY_REASON,
  type QueuedSong,
  type StemPlayerStatus,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { countInOptionLabel } from '../logic/clickChipText.ts';
import { lockBadgeOf } from '../logic/lockText.ts';
import { canReanalyze } from '../logic/notices.ts';
import { METER_FAILED, meterGridState } from '../logic/songMeterText.ts';
import {
  TEMPO_CORRECTION_COPY,
  tempoCorrectionValue,
} from '../logic/tempoCorrectionText.ts';
import {
  PLAYER_MENU_TEXT,
  REANALYZE_LABEL,
  SONG_SPEED_TEXT,
} from '../logic/viewText.ts';
import { useSongFailure } from './rowFailureHooks.ts';

interface SongPlayerMenuProps {
  readonly songId: number;
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onBack: () => void;
  readonly onMeter: () => void;
  readonly onTempoMode: () => void;
  readonly onTempoCorrection: () => void;
  readonly onCountIn: () => void;
  readonly notice: Notice;
  readonly onOpenQueue: () => void;
  readonly onOpenSetlist: (setlistId: number) => void;
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

function useLiveOnlyRow() {
  const gated = useGridGatedRow();
  const viewing = useSongViewing();
  return viewing ? { disabled: true, detail: VIEW_ONLY_REASON } : gated;
}

function SongMeterRow({ onPress }: RowProps) {
  const override = useSongPlayer((s) => s.meterOverride);
  const detected = useSongPlayer((s) => s.detected.meter);
  const { disabled, detail } = useLiveOnlyRow();
  return (
    <MeterRow
      value={override.meterBeatsPerBar ?? detected}
      yours={isOverridden(override)}
      disabled={disabled}
      {...(detail === undefined ? {} : { reason: detail })}
      onPress={onPress}
    />
  );
}

function SongTempoModeRow({ onPress }: RowProps) {
  const { disabled, detail } = useLiveOnlyRow();
  const reason = useSongPlayer((s) => tempoUnavailable(s.tempo, 'song'));
  const mode = useSongPlayer((s) => s.tempoMode);
  return (
    <TempoModeRow
      value={tempoModeLabel(mode)}
      reason={disabled ? (detail ?? null) : reason}
      onPress={onPress}
    />
  );
}

function TempoCorrectionRow({ onPress }: RowProps) {
  const correction = useSongPlayer((s) => s.tempoCorrection);
  const detectedBpm = useSongPlayer((s) => s.detectedBpm);
  const { disabled, detail } = useLiveOnlyRow();
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

function ResetSpeedRow({ onPress }: RowProps) {
  const resetSpeed = useSongPlayer((s) => s.resetSpeed);
  const reset = useCallback(() => {
    onPress();
    void resetSpeed();
  }, [onPress, resetSpeed]);
  return (
    <MenuRow
      icon="reset"
      label={SONG_SPEED_TEXT.reset}
      value={speedPercentText(KB_MIXER_UNITY_RATE)}
      onPress={reset}
    />
  );
}

interface QueueRowsProps {
  readonly songId: number;
  readonly notice: Notice;
  readonly onDismiss: () => void;
  readonly onOpenQueue: () => void;
  readonly onOpenSetlist: (setlistId: number) => void;
}

function QueueRows({
  songId,
  notice,
  onDismiss,
  onOpenQueue,
  onOpenSetlist,
}: QueueRowsProps) {
  useQueueRefresh();
  const queueSong = useQueueSong();
  const actions = useQueueNotices(
    notice,
    queueSong,
    onOpenSetlist,
    onOpenQueue,
  );
  const title = useSongPlayer((s) => s.title);
  const target = useMemo(
    () => ({ song: { kind: 'song', id: songId } as const, title }),
    [songId, title],
  );
  const presses = useQueuePresses<QueuedSong>(actions, target, onDismiss);
  const keys = useQueueKeys(presses, useIsQueued(target.song));
  return (
    <>
      <MenuRow
        icon="playNext"
        label={QUEUE_TEXT.playNext}
        onPress={keys.playNext}
      />
      <MenuRow
        icon="addToQueue"
        label={keys.addLabel}
        onPress={keys.addToQueue}
      />
    </>
  );
}

export function SongPlayerMenu({
  songId,
  visible,
  bottomInset,
  onDismiss,
  onBack,
  onMeter,
  onTempoMode,
  onTempoCorrection,
  onCountIn,
  notice,
  onOpenQueue,
  onOpenSetlist,
}: SongPlayerMenuProps) {
  const close = useLiveSongPlayer((s) => s.close);
  const viewing = useSongViewing();
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
  const openTempoMode = useCallback(() => {
    onDismiss();
    onTempoMode();
  }, [onDismiss, onTempoMode]);
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
      <QueueRows
        songId={songId}
        notice={notice}
        onDismiss={onDismiss}
        onOpenQueue={onOpenQueue}
        onOpenSetlist={onOpenSetlist}
      />
      <ResetSpeedRow onPress={onDismiss} />
      {reanalyzable ? (
        <MenuRow
          icon="analyzing"
          label={REANALYZE_LABEL}
          detail={PLAYER_MENU_TEXT.reanalyzeDetail}
          onPress={onReanalyze}
        />
      ) : null}
      <SongMeterRow onPress={openMeter} />
      <SongTempoModeRow onPress={openTempoMode} />
      <TempoCorrectionRow onPress={openTempoCorrection} />
      <CountInRow onPress={openCountIn} />
      {viewing ? null : (
        <MenuRow
          icon="stop"
          label={PLAYER_MENU_TEXT.stop}
          detail={PLAYER_MENU_TEXT.stopDetail}
          onPress={stop}
        />
      )}
    </Sheet>
  );
}
