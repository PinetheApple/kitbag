import { boottimeNowMs } from '@kitbag/core-native';
import {
  BPM_SOURCE,
  getPlayAlongStore,
  tempoLadderStore,
  useTempoLadder,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';

interface PadInputs {
  readonly following: boolean;
  readonly locked: boolean;
  readonly retap: boolean;
  readonly onLanded: () => void;
}

export function useTapPad({ following, locked, retap, onLanded }: PadInputs) {
  const bpm = useTempoLadder((s) => s.bpm);
  const source = useTempoLadder((s) => s.source);
  const tapsLanded = useTempoLadder((s) => s.tapsLanded);
  const copy = tapPadCopy({
    following,
    locked,
    retap,
    songBpm: bpm,
    tappedBpm: source === BPM_SOURCE.tap ? bpm : null,
    tapsLanded,
  });
  const onTap = useCallback(() => {
    const now = boottimeNowMs();
    if (copy.mode === TAP_PAD_MODE.tempo) {
      tempoLadderStore.getState().tap(now);
      return;
    }
    if (getPlayAlongStore().getState().tap(now).locked) onLanded();
  }, [copy.mode, onLanded]);
  return { copy, tapsLanded, onTap };
}
