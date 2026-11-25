import type { MeterSheetNotice } from '@kitbag/core-design';
import {
  useLiveSongPlayer,
  useSongLibrary,
  useSongPlayer,
  type TempoCorrection,
} from '@kitbag/core-state';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

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

interface Choice {
  readonly next: TempoCorrection;
  readonly announce: boolean;
}

export interface SongTempoCorrection {
  readonly correction: TempoCorrection;
  readonly notice: MeterSheetNotice | null;
  readonly onPick: (correction: TempoCorrection) => void;
}

function takeQueued(queued: RefObject<Choice | null>): Choice | null {
  const next = queued.current;
  queued.current = null;
  return next;
}

export function useSongTempoCorrection(songId: number): SongTempoCorrection {
  const correction = useSongPlayer((s) => s.tempoCorrection);
  const detectedBpm = useSongPlayer((s) => s.detectedBpm);
  const apply = useLiveSongPlayer((s) => s.tempoCorrectionChanged);
  const settle = useLiveSongPlayer((s) => s.tempoCorrectionSettled);
  const save = useSongLibrary((s) => s.saveSongTempoCorrection);
  const [pending, setPending] = useState<TempoNoticeState | null>(null);
  const [picked, setPicked] = useState<TempoCorrection | null>(null);
  const shown = useRef(correction);
  const queued = useRef<Choice | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    if (!saving.current) shown.current = correction;
  }, [correction]);

  const saveOne = useCallback(
    async ({ next, announce }: Choice) => {
      const previous = shown.current;
      shown.current = next;
      apply(songId, next);
      if (!(await save(songId, next))) {
        shown.current = previous;
        apply(songId, previous);
        setPending({ kind: 'failed', next });
        return;
      }
      const text = tempoSetText(next, detectedBpm);
      setPending(announce ? { kind: 'undo', text, previous } : null);
    },
    [detectedBpm, apply, save, songId],
  );

  const change = useCallback(
    async (choice: Choice) => {
      queued.current = choice;
      setPicked(choice.next);
      setPending(null);
      if (saving.current) return;
      saving.current = true;
      for (let next = takeQueued(queued); next !== null;) {
        await saveOne(next);
        next = takeQueued(queued);
      }
      saving.current = false;
      settle(songId);
      setPicked(null);
    },
    [saveOne, settle, songId],
  );

  const onPick = useCallback(
    (next: TempoCorrection) => {
      const latest = queued.current?.next ?? shown.current;
      if (next !== latest) void change({ next, announce: true });
    },
    [change],
  );

  const onAction = useCallback(() => {
    if (pending === null) return;
    if (pending.kind === 'undo')
      void change({ next: pending.previous, announce: false });
    else void change({ next: pending.next, announce: true });
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

  return { correction: picked ?? correction, notice, onPick };
}
