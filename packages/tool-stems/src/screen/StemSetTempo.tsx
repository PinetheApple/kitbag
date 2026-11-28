import {
  Button,
  MenuRow,
  SET_TEMPO_COPY,
  SetTempoSheet,
  Snackbar,
  snackbar,
  useSetTempo,
  useTempoPreview,
} from '@kitbag/core-design';
import {
  framesToSeconds,
  useLiveStemPlayer,
  useLoopScrub,
  useStemPlayer,
  useStemViewing,
  viewOnlyReason,
} from '@kitbag/core-state';
import type { MixerFrameValues } from '@kitbag/core-plugin-api';
import { useCallback, useMemo } from 'react';

import { UNDO } from '../logic/meterEdit.ts';
import {
  SET_TEMPO_UNLOCKS,
  STEM_SET_TEMPO,
  STEM_TEMPO_ENTRY,
  stemTempoEntry,
} from '../logic/setTempoView.ts';

interface PressProps {
  readonly onPress: () => void;
}

export function SetTempoButton({ onPress }: PressProps) {
  const viewing = useStemViewing();
  return (
    <Button
      label={SET_TEMPO_COPY.title}
      icon="metronome"
      iconSize="sheetButton"
      variant="accentTonal"
      size="target"
      disabled={viewing}
      disabledLook="faded"
      onPress={onPress}
    />
  );
}

export function StemSetTempoRow({ onPress }: PressProps) {
  const entry = useStemPlayer(stemTempoEntry);
  const manualBpm = useStemPlayer((s) => s.manualTempo?.bpm ?? null);
  const viewOnly = viewOnlyReason(null, useStemViewing());
  if (entry === STEM_TEMPO_ENTRY.none) return null;
  const editing = entry === STEM_TEMPO_ENTRY.edit;
  const value =
    editing && manualBpm !== null
      ? STEM_SET_TEMPO.text.bpmText(manualBpm)
      : undefined;
  return (
    <MenuRow
      icon="tapAlong"
      label={editing ? SET_TEMPO_COPY.tempo : SET_TEMPO_COPY.title}
      detail={
        viewOnly ?? (editing ? SET_TEMPO_COPY.tempoDetail : SET_TEMPO_UNLOCKS)
      }
      value={viewOnly === null ? value : undefined}
      valueTone={editing ? 'accent' : 'plain'}
      disabled={viewOnly !== null}
      onPress={onPress}
    />
  );
}

function useStemTempoPlayer() {
  const manualTempo = useStemPlayer((s) => s.manualTempo);
  const override = useStemPlayer((s) => s.meterOverride);
  const detectedMeter = useStemPlayer((s) => s.detectedMeter);
  const detectedBarOne = useStemPlayer((s) => s.detectedBarOneSeconds);
  const durationSec = useStemPlayer((s) =>
    framesToSeconds(s.durationFrames, s.engineRate),
  );
  const playheadSeconds = useLiveStemPlayer((s) => s.playheadSeconds);
  const setManualTempo = useLiveStemPlayer((s) => s.setManualTempo);
  const previewTempo = useLiveStemPlayer((s) => s.previewTempo);
  return useMemo(
    () => ({
      seed: {
        manualTempo,
        analysedBpm: null,
        barOneSeconds: override.barOneSeconds ?? detectedBarOne,
        meter: override.meterBeatsPerBar ?? detectedMeter,
      },
      durationSec,
      playheadSeconds,
      setManualTempo,
      previewTempo,
    }),
    [
      manualTempo,
      override,
      detectedMeter,
      detectedBarOne,
      durationSec,
      playheadSeconds,
      setManualTempo,
      previewTempo,
    ],
  );
}

function useSheetControls() {
  const togglePlay = useStemPlayer((s) => s.togglePlay);
  const scrub = useLoopScrub(useStemPlayer);
  const click = useStemPlayer((s) => s.click);
  const toggleClick = useLiveStemPlayer((s) => s.toggleClick);
  const onToggle = useCallback(() => {
    void toggleClick();
  }, [toggleClick]);
  const transport = useMemo(
    () => ({ onTogglePlay: togglePlay, scrub }),
    [togglePlay, scrub],
  );
  const previewClick = useMemo(
    () => ({ on: click, onToggle }),
    [click, onToggle],
  );
  return { transport, previewClick };
}

export interface StemSetTempoSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playhead: MixerFrameValues;
  readonly onClose: () => void;
}

export function StemSetTempoSheet({
  visible,
  bottomInset,
  playhead,
  onClose,
}: StemSetTempoSheetProps) {
  const player = useStemTempoPlayer();
  const tempo = useSetTempo(STEM_SET_TEMPO, player, { onClose });
  useTempoPreview(tempo, visible, player.previewTempo);
  const { transport, previewClick } = useSheetControls();
  return (
    <SetTempoSheet
      visible={visible}
      bottomInset={bottomInset}
      playhead={playhead}
      tempo={tempo}
      transport={transport}
      previewClick={previewClick}
      onClose={onClose}
    />
  );
}

export function TempoUndoSnackbar() {
  const undoable = useLiveStemPlayer((s) => s.tempoUndoable);
  const manualTempo = useLiveStemPlayer((s) => s.manualTempo);
  const undoTempo = useLiveStemPlayer((s) => s.undoTempo);
  const dismissTempoUndo = useLiveStemPlayer((s) => s.dismissTempoUndo);
  const onUndo = useCallback(() => {
    void undoTempo();
  }, [undoTempo]);
  if (!undoable || manualTempo === null) return null;
  return (
    <Snackbar
      message={STEM_SET_TEMPO.text.savedText(manualTempo)}
      actionLabel={UNDO}
      bottom={snackbar.aboveDock}
      onAction={onUndo}
      onTimeout={dismissTempoUndo}
    />
  );
}
