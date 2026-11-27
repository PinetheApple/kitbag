import {
  openNumpadEntry,
  pressNumpadBackspace,
  pressNumpadDigit,
  type NumpadEntry,
} from '@kitbag/core-design';
import {
  MANUAL_TEMPO_BOUNDS,
  pushManualTap,
  tappedManualBpm,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

import {
  doubleOf,
  halfOf,
  shownTypedBpm,
  type TempoSeed,
} from '../logic/manualTempoDraft.ts';

export const ENTRY_MODE = { type: 'type', tap: 'tap' } as const;
export type EntryMode = (typeof ENTRY_MODE)[keyof typeof ENTRY_MODE];

const EMPTY_ENTRY: NumpadEntry = { digits: '', untouched: false };
const NO_TAPS: readonly number[] = [];

const entryOf = (bpm: number | null) =>
  bpm === null ? EMPTY_ENTRY : openNumpadEntry(bpm);

const typedEntry = (bpm: number): NumpadEntry => ({
  digits: String(bpm),
  untouched: false,
});

function useTyping(seed: TempoSeed) {
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const shown = shownTypedBpm(entry, seed.bpm);
  const onDigit = useCallback((digit: number) => {
    setEntry((now) => pressNumpadDigit(now, digit, MANUAL_TEMPO_BOUNDS));
  }, []);
  const onBackspace = useCallback(() => {
    setEntry(pressNumpadBackspace);
  }, []);
  const onHalve = useCallback(() => {
    if (shown !== undefined) setEntry(typedEntry(halfOf(shown)));
  }, [shown]);
  const onDouble = useCallback(() => {
    if (shown !== undefined) setEntry(typedEntry(doubleOf(shown)));
  }, [shown]);
  const resetEntry = useCallback((next: TempoSeed) => {
    setEntry(entryOf(next.bpm));
  }, []);
  return { entry, shown, onDigit, onBackspace, onHalve, onDouble, resetEntry };
}

function useTapping() {
  const [taps, setTaps] = useState(NO_TAPS);
  const onTap = useCallback((event: GestureResponderEvent) => {
    const at = event.nativeEvent.timestamp;
    setTaps((now) => pushManualTap(now, at));
  }, []);
  const onStartOver = useCallback(() => {
    setTaps(NO_TAPS);
  }, []);
  return { taps, tappedBpm: tappedManualBpm(taps), onTap, onStartOver };
}

export function useSetTempoEntry(seed: TempoSeed) {
  const [mode, setMode] = useState<EntryMode>(ENTRY_MODE.type);
  const typing = useTyping(seed);
  const tapping = useTapping();
  const { resetEntry } = typing;
  const { onStartOver } = tapping;
  const resetModes = useCallback(
    (next: TempoSeed) => {
      setMode(ENTRY_MODE.type);
      resetEntry(next);
      onStartOver();
    },
    [resetEntry, onStartOver],
  );
  return { mode, setMode, resetModes, ...typing, ...tapping };
}

export type SetTempoEntry = ReturnType<typeof useSetTempoEntry>;
