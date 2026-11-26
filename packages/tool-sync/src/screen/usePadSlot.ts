import { boottimeNowMs, type MediaSessionSnapshot } from '@kitbag/core-native';
import {
  BPM_SOURCE,
  getPlayAlongStore,
  tempoLadderStore,
  useTempoLadder,
  type PlayAlongLock,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { DRIFT_STATE, driftState } from '../logic/driftMeter.ts';
import { lockLayout } from '../logic/lockLayout.ts';
import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';
import { usePlayAlong } from './playAlongHooks.ts';

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

export function useLockedPad(
  session: MediaSessionSnapshot | undefined,
  lock: PlayAlongLock | undefined,
) {
  const [retapping, setRetapping] = useState(false);
  const [padHeld, setPadHeld] = useState(false);
  const songAheadOfClickMs = usePlayAlong((s) => s.songAheadOfClickMs);
  const sourceGoneAtMs = usePlayAlong((s) => s.sourceGoneAtBoottimeMs);
  const state = driftState({
    songAheadOfClickMs,
    playing: session?.playing === true,
    sourceGoneAtMs,
  });
  const drifting = state === DRIFT_STATE.drift;
  const locked = lock !== undefined;
  const silenced =
    locked && (state === DRIFT_STATE.paused || state === DRIFT_STATE.holding);
  const retap = locked && (drifting || retapping);
  const layout = lockLayout({ locked, drifting, retapping: retap, padHeld });
  const onRetap = useCallback(() => {
    setRetapping(true);
  }, []);
  const onLanded = useCallback(() => {
    setRetapping(false);
    setPadHeld(true);
  }, []);
  const onRelease = useCallback(() => {
    setPadHeld(false);
  }, []);
  return { layout, retap, silenced, onRetap, onLanded, onRelease };
}
