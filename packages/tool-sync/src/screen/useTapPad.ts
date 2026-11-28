import {
  BPM_SOURCE,
  getPlayAlongStore,
  tempoLadderStore,
  useTempoLadder,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import type { GestureResponderEvent } from 'react-native';

import { PAD_ACTION } from '../logic/tapAlongCopy.ts';
import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';
import { usePlayAlong } from './playAlongHooks.ts';
import { touchedAtBoottimeMs } from './touchTime.ts';

interface PadInputs {
  readonly following: boolean;
  readonly lockBpm: number | null;
  readonly playing: boolean;
  readonly retap: boolean;
  readonly onLanded: () => void;
}

export function useTapPad({
  following,
  lockBpm,
  playing,
  retap,
  onLanded,
}: PadInputs) {
  const songBpm = usePlayAlong((s) => s.bpm) ?? null;
  const offered = usePlayAlong((s) => s.offer !== undefined);
  const tapAlong = usePlayAlong((s) => s.tapAlong);
  const ladderBpm = useTempoLadder((s) => s.bpm);
  const source = useTempoLadder((s) => s.source);
  const tapsLanded = useTempoLadder((s) => s.tapsLanded);
  const copy = tapPadCopy({
    following,
    lockBpm,
    playing,
    retap,
    offered,
    songBpm,
    tappedBpm: source === BPM_SOURCE.tap ? ladderBpm : null,
    tapsLanded,
    tapAlong,
  });
  const onTap = useCallback(
    (event: GestureResponderEvent) => {
      const touchedAt = touchedAtBoottimeMs(event);
      if (copy.mode === TAP_PAD_MODE.tempo)
        tempoLadderStore.getState().tap(touchedAt);
      else if (copy.mode === TAP_PAD_MODE.along) {
        if (getPlayAlongStore().getState().tapToLock(touchedAt)) onLanded();
      }
    },
    [copy.mode, onLanded],
  );
  const onAction = useCallback(() => {
    const store = getPlayAlongStore().getState();
    if (copy.action === PAD_ACTION.accentRight) store.keepAccent();
    else store.startTapsOver();
  }, [copy.action]);
  return { copy, onTap, onAction };
}
