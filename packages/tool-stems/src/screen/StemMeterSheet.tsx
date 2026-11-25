import { MeterSheet, type MeterSheetNotice } from '@kitbag/core-design';
import {
  GRID_METERS,
  isGridMeter,
  stemPlayerStore,
  useLiveStemPlayer,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import {
  barOneHere,
  createMeterEditor,
  meterGridState,
  NO_GRID_REASON,
  type MeterEdit,
  type MeterEditTarget,
  type MeterNotice,
} from '../logic/meterEdit.ts';

function openSong(): MeterEditTarget | null {
  const { setId, meterOverride, detectedMeter } = stemPlayerStore.getState();
  if (setId === null) return null;
  return { setId, override: meterOverride, detected: detectedMeter };
}

function useMeterEditor() {
  const save = useLiveStemPlayer((s) => s.saveMeterOverride);
  const applied = useLiveStemPlayer((s) => s.meterOverrideChanged);
  return useMemo(
    () => createMeterEditor({ save, applied, target: openSong }),
    [save, applied],
  );
}

function useMeterEdits() {
  const editor = useMeterEditor();
  const [notice, setNotice] = useState<MeterNotice | null>(null);
  const shownIn = useRef(0);
  const settle = useCallback(async (result: Promise<MeterNotice | null>) => {
    const opening = shownIn.current;
    const next = await result;
    if (opening === shownIn.current) setNotice(next);
  }, []);
  const edit = useCallback(
    (change: MeterEdit) => {
      void settle(editor.edit(change));
    },
    [editor, settle],
  );
  const act = useCallback(
    (shown: MeterNotice) => {
      void settle(editor.act(shown));
    },
    [editor, settle],
  );
  const dismiss = useCallback(() => {
    setNotice(null);
  }, []);
  const closed = useCallback(() => {
    shownIn.current += 1;
    setNotice(null);
  }, []);
  return { notice, edit, act, dismiss, closed };
}

function useSheetNotice(
  notice: MeterNotice | null,
  act: (shown: MeterNotice) => void,
  dismiss: () => void,
): MeterSheetNotice | null {
  return useMemo(() => {
    if (notice === null) return null;
    return {
      message: notice.message,
      actionLabel: notice.actionLabel,
      onAction: () => {
        act(notice);
      },
      onTimeout: () => {
        dismiss();
      },
    };
  }, [notice, act, dismiss]);
}

function useMeterHandlers(edit: (change: MeterEdit) => void) {
  const pickMeter = useCallback(
    (meter: number) => {
      if (isGridMeter(meter)) edit({ kind: 'meter', meter });
    },
    [edit],
  );
  const barOne = useCallback(() => {
    const { beats, playheadSeconds } = stemPlayerStore.getState();
    const seconds = barOneHere(beats, playheadSeconds());
    if (seconds !== null) edit({ kind: 'barOne', seconds });
  }, [edit]);
  const reset = useCallback(() => {
    edit({ kind: 'reset' });
  }, [edit]);
  return { pickMeter, barOne, reset };
}

interface StemMeterSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playhead: SharedValue<number>;
  readonly onClose: () => void;
}

export function StemMeterSheet({
  visible,
  bottomInset,
  playhead,
  onClose,
}: StemMeterSheetProps) {
  const override = useLiveStemPlayer((s) => s.meterOverride);
  const detectedMeter = useLiveStemPlayer((s) => s.detectedMeter);
  const detectedBarOne = useLiveStemPlayer((s) => s.detectedBarOneSeconds);
  const state = useLiveStemPlayer((s) => meterGridState(s.beats));
  const { notice, edit, act, dismiss, closed } = useMeterEdits();
  const sheetNotice = useSheetNotice(notice, act, dismiss);
  const { pickMeter, barOne, reset } = useMeterHandlers(edit);
  const close = useCallback(() => {
    closed();
    onClose();
  }, [closed, onClose]);
  return (
    <MeterSheet
      visible={visible}
      options={GRID_METERS}
      detectedMeter={detectedMeter}
      detectedBarOneSeconds={detectedBarOne}
      override={override}
      playheadSeconds={playhead}
      state={state}
      failedReason={NO_GRID_REASON}
      notice={sheetNotice}
      bottomInset={bottomInset}
      onPickMeter={pickMeter}
      onBarOneHere={barOne}
      onReset={reset}
      onClose={close}
    />
  );
}
