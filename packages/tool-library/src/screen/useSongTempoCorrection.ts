import type { MeterSheetNotice } from '@kitbag/core-design';
import {
  useSongLibrary,
  useSongPlayer,
  type TempoCorrection,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';

import { UNDO_LABEL } from '../logic/songMeterText.ts';
import {
  TEMPO_CORRECTION_COPY,
  tempoSetText,
  type TempoCorrectionText,
} from '../logic/tempoCorrectionText.ts';
import { TRY_AGAIN_LABEL } from '../logic/viewText.ts';

type TempoNoticeState =
  | {
      readonly kind: 'undo';
      readonly text: TempoCorrectionText;
      readonly previous: TempoCorrection;
    }
  | { readonly kind: 'failed'; readonly next: TempoCorrection };

export interface SongTempoCorrection {
  readonly correction: TempoCorrection;
  readonly notice: MeterSheetNotice | null;
  readonly onPick: (correction: TempoCorrection) => void;
}

export function useSongTempoCorrection(songId: number): SongTempoCorrection {
  const correction = useSongPlayer((s) => s.tempoCorrection);
  const detectedBpm = useSongPlayer((s) => s.detectedBpm);
  const apply = useSongPlayer((s) => s.tempoCorrectionChanged);
  const save = useSongLibrary((s) => s.saveSongTempoCorrection);
  const [pending, setPending] = useState<TempoNoticeState | null>(null);
  const saving = useRef(false);

  const change = useCallback(
    async (next: TempoCorrection, announce: boolean) => {
      if (saving.current) return;
      saving.current = true;
      const previous = correction;
      apply(songId, next);
      const saved = await save(songId, next);
      saving.current = false;
      if (!saved) {
        apply(songId, previous);
        setPending({ kind: 'failed', next });
        return;
      }
      const text = tempoSetText(next, detectedBpm);
      setPending(announce ? { kind: 'undo', text, previous } : null);
    },
    [correction, detectedBpm, apply, save, songId],
  );

  const onPick = useCallback(
    (next: TempoCorrection) => {
      if (next !== correction) void change(next, true);
    },
    [correction, change],
  );

  const onAction = useCallback(() => {
    if (pending === null) return;
    if (pending.kind === 'undo') void change(pending.previous, false);
    else void change(pending.next, true);
  }, [pending, change]);

  const dismiss = useCallback(() => {
    setPending(null);
  }, []);

  const notice = useMemo(() => {
    if (pending === null) return null;
    const failed = pending.kind === 'failed';
    const message = failed
      ? TEMPO_CORRECTION_COPY.saveFailed
      : pending.text.shown;
    return {
      message,
      spokenMessage: failed ? message : pending.text.spoken,
      actionLabel: failed ? TRY_AGAIN_LABEL : UNDO_LABEL,
      onAction,
      onTimeout: dismiss,
    };
  }, [pending, onAction, dismiss]);

  return { correction, notice, onPick };
}
