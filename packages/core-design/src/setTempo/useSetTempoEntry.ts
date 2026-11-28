import { useCallback, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

import {
  openNumpadEntry,
  pressNumpadBackspace,
  pressNumpadDigit,
  type NumpadEntry,
} from '../numpadEntry.ts';
import { doubleOf, halfOf, shownTypedBpm, type TempoSeed } from './draft.ts';
import type { SetTempoRules } from './rules.ts';

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

function useTyping<M extends number>(
  seed: TempoSeed<M>,
  rules: SetTempoRules<M>,
) {
  const [numpad, setNumpad] = useState(EMPTY_ENTRY);
  const shown = shownTypedBpm(numpad, seed.bpm);
  const { bounds } = rules;
  const onDigit = useCallback(
    (digit: number) => {
      setNumpad((now) => pressNumpadDigit(now, digit, bounds));
    },
    [bounds],
  );
  const onBackspace = useCallback(() => {
    setNumpad(pressNumpadBackspace);
  }, []);
  const onHalve = useCallback(() => {
    if (shown !== undefined) setNumpad(typedEntry(halfOf(shown)));
  }, [shown]);
  const onDouble = useCallback(() => {
    if (shown !== undefined) setNumpad(typedEntry(doubleOf(shown)));
  }, [shown]);
  const resetEntry = useCallback((next: TempoSeed<M>) => {
    setNumpad(entryOf(next.bpm));
  }, []);
  return { numpad, shown, onDigit, onBackspace, onHalve, onDouble, resetEntry };
}

function useTapping<M extends number>(rules: SetTempoRules<M>) {
  const [taps, setTaps] = useState(NO_TAPS);
  const { pushTap } = rules;
  const onTap = useCallback(
    (event: GestureResponderEvent) => {
      const at = event.nativeEvent.timestamp;
      setTaps((now) => pushTap(now, at));
    },
    [pushTap],
  );
  const onStartOver = useCallback(() => {
    setTaps(NO_TAPS);
  }, []);
  return { taps, tappedBpm: rules.tappedBpm(taps), onTap, onStartOver };
}

export function useSetTempoEntry<M extends number>(
  seed: TempoSeed<M>,
  rules: SetTempoRules<M>,
) {
  const [mode, setMode] = useState<EntryMode>(ENTRY_MODE.type);
  const typing = useTyping(seed, rules);
  const tapping = useTapping(rules);
  const { resetEntry } = typing;
  const { onStartOver } = tapping;
  const resetModes = useCallback(
    (next: TempoSeed<M>) => {
      setMode(ENTRY_MODE.type);
      resetEntry(next);
      onStartOver();
    },
    [resetEntry, onStartOver],
  );
  return { mode, setMode, resetModes, ...typing, ...tapping };
}

export type SetTempoEntry<M extends number = number> = ReturnType<
  typeof useSetTempoEntry<M>
>;
