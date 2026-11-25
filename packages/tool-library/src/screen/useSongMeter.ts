import type { MeterSheetNotice } from '@kitbag/core-design';
import {
  isGridMeter,
  NO_METER_OVERRIDE,
  useLiveSongPlayer,
  useSongLibrary,
  useSongPlayer,
  type MeterOverride,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  barOneMovedText,
  DETECTED_RESTORED,
  METER_SAVE_FAILED,
  meterSetText,
  UNDO_LABEL,
} from '../logic/songMeterText.ts';
import { TRY_AGAIN_LABEL } from '../logic/viewText.ts';

type MeterNoticeState =
  | {
      readonly kind: 'undo';
      readonly message: string;
      readonly previous: MeterOverride;
    }
  | {
      readonly kind: 'failed';
      readonly next: MeterOverride;
      readonly message: string | null;
    };

export interface SongMeter {
  readonly override: MeterOverride;
  readonly notice: MeterSheetNotice | null;
  readonly onPickMeter: (meter: number) => void;
  readonly onBarOneHere: () => void;
  readonly onReset: () => void;
}

export function useSongMeter(songId: number): SongMeter {
  const override = useSongPlayer((s) => s.meterOverride);
  const detectedMeter = useSongPlayer((s) => s.detected.meter);
  const apply = useLiveSongPlayer((s) => s.meterOverrideChanged);
  const beatAtPlayhead = useLiveSongPlayer((s) => s.playheadBeatSeconds);
  const save = useSongLibrary((s) => s.saveSongMeterOverride);
  const [pending, setPending] = useState<MeterNoticeState | null>(null);
  const saving = useRef(false);

  const change = useCallback(
    async (next: MeterOverride, message: string | null) => {
      if (saving.current) return;
      saving.current = true;
      const previous = override;
      apply(songId, next);
      const saved = await save(songId, next);
      saving.current = false;
      if (!saved) {
        apply(songId, previous);
        setPending({ kind: 'failed', next, message });
        return;
      }
      setPending(message === null ? null : { kind: 'undo', message, previous });
    },
    [override, apply, save, songId],
  );

  const onPickMeter = useCallback(
    (meter: number) => {
      const shown = override.meterBeatsPerBar ?? detectedMeter;
      if (!isGridMeter(meter) || meter === shown) return;
      void change(
        { ...override, meterBeatsPerBar: meter },
        meterSetText(meter),
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

  const onAction = useCallback(() => {
    if (pending === null) return;
    if (pending.kind === 'undo') void change(pending.previous, null);
    else void change(pending.next, pending.message);
  }, [pending, change]);

  const dismiss = useCallback(() => {
    setPending(null);
  }, []);

  const notice = useMemo(() => {
    if (pending === null) return null;
    const undo = pending.kind === 'undo';
    return {
      message: undo ? pending.message : METER_SAVE_FAILED,
      actionLabel: undo ? UNDO_LABEL : TRY_AGAIN_LABEL,
      onAction,
      onTimeout: dismiss,
    };
  }, [pending, onAction, dismiss]);

  return { override, notice, onPickMeter, onBarOneHere, onReset };
}
