import type { MeterSheetNotice } from '@kitbag/core-design';
import {
  GRID_METERS,
  NO_METER_OVERRIDE,
  useSongLibrary,
  useSongPlayer,
  type MeterOverride,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import {
  barOneMovedText,
  DETECTED_RESTORED,
  meterSetText,
  UNDO_LABEL,
} from '../logic/songMeterText.ts';

interface Undo {
  readonly message: string;
  readonly previous: MeterOverride;
}

export interface SongMeter {
  readonly override: MeterOverride;
  readonly undo: MeterSheetNotice | null;
  readonly onPickMeter: (meter: number) => void;
  readonly onBarOneHere: () => void;
  readonly onReset: () => void;
}

export function useSongMeter(songId: number): SongMeter {
  const override = useSongPlayer((s) => s.meterOverride);
  const detectedMeter = useSongPlayer((s) => s.detected.meter);
  const apply = useSongPlayer((s) => s.meterOverrideChanged);
  const beatAtPlayhead = useSongPlayer((s) => s.playheadBeatSeconds);
  const save = useSongLibrary((s) => s.saveSongMeterOverride);
  const [undo, setUndo] = useState<Undo | null>(null);

  const change = useCallback(
    async (next: MeterOverride, message: string | null) => {
      const previous = override;
      apply(songId, next);
      const saved = await save(songId, next);
      if (!saved) apply(songId, previous);
      setUndo(saved && message !== null ? { message, previous } : null);
    },
    [override, apply, save, songId],
  );

  const onPickMeter = useCallback(
    (meter: number) => {
      const picked = GRID_METERS.find((m) => m === meter);
      const shown = override.meterBeatsPerBar ?? detectedMeter;
      if (picked === undefined || picked === shown) return;
      void change(
        { ...override, meterBeatsPerBar: picked },
        meterSetText(picked),
      );
    },
    [override, detectedMeter, change],
  );

  const onBarOneHere = useCallback(() => {
    const seconds = beatAtPlayhead();
    if (seconds === null) return;
    void change(
      { ...override, barOneSeconds: seconds },
      barOneMovedText(seconds),
    );
  }, [beatAtPlayhead, override, change]);

  const onReset = useCallback(() => {
    void change(NO_METER_OVERRIDE, DETECTED_RESTORED);
  }, [change]);

  const onUndo = useCallback(() => {
    if (undo !== null) void change(undo.previous, null);
  }, [undo, change]);

  const dismissUndo = useCallback(() => {
    setUndo(null);
  }, []);

  const notice = useMemo(
    () =>
      undo === null
        ? null
        : {
            message: undo.message,
            actionLabel: UNDO_LABEL,
            onAction: onUndo,
            onTimeout: dismissUndo,
          },
    [undo, onUndo, dismissUndo],
  );

  return { override, undo: notice, onPickMeter, onBarOneHere, onReset };
}
