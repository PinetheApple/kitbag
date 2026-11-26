import {
  BPM_SOURCE,
  getPlayAlongStore,
  tempoLadderStore,
  useTempoLadder,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import type { GestureResponderEvent } from 'react-native';

import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';
import { usePlayAlong } from './playAlongHooks.ts';
import { touchedAtBoottimeMs } from './touchTime.ts';

interface PadInputs {
  readonly following: boolean;
  readonly locked: boolean;
  readonly retap: boolean;
  readonly onLanded: () => void;
}

export function useTapPad({ following, locked, retap, onLanded }: PadInputs) {
  const songBpm = usePlayAlong((s) => s.bpm) ?? null;
  const offered = usePlayAlong((s) => s.offer !== undefined);
  const ladderBpm = useTempoLadder((s) => s.bpm);
  const source = useTempoLadder((s) => s.source);
  const tapsLanded = useTempoLadder((s) => s.tapsLanded);
  const copy = tapPadCopy({
    following,
    locked,
    retap,
    offered,
    songBpm,
    tappedBpm: source === BPM_SOURCE.tap ? ladderBpm : null,
    tapsLanded,
  });
  const onTap = useCallback(
    (event: GestureResponderEvent) => {
      const touchedAt = touchedAtBoottimeMs(event);
      if (copy.mode === TAP_PAD_MODE.tempo) {
        tempoLadderStore.getState().tap(touchedAt);
        return;
      }
      if (getPlayAlongStore().getState().tap(touchedAt).locked) onLanded();
    },
    [copy.mode, onLanded],
  );
  return { copy, tapsLanded, onTap };
}
