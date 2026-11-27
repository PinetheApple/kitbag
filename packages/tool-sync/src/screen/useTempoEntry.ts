import {
  confirmNumpadEntry,
  openNumpadEntry,
  pressNumpadBackspace,
  pressNumpadDigit,
  type NumpadEntry,
} from '@kitbag/core-design';
import {
  BPM_BOUNDS,
  BPM_SOURCE,
  doubledBpm,
  halvedBpm,
  TAPS_TO_SET_TEMPO,
  tempoLadderStore,
  useTempoLadder,
} from '@kitbag/core-state';
import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { GestureResponderEvent } from 'react-native';

import { usePlayAlong } from './playAlongHooks.ts';
import { touchedAtBoottimeMs } from './touchTime.ts';

const EMPTY_ENTRY: NumpadEntry = { digits: '', untouched: false };

const entryOf = (bpm: number | null) =>
  bpm === null ? EMPTY_ENTRY : openNumpadEntry(Math.round(bpm));

interface EntryState {
  readonly entry: NumpadEntry;
  readonly setEntry: Dispatch<SetStateAction<NumpadEntry>>;
  readonly tapping: boolean;
  readonly setTapping: (tapping: boolean) => void;
}

function useKeys(
  { entry, setEntry, tapping, setTapping }: EntryState,
  onDone: () => void,
) {
  const setBpm = usePlayAlong((s) => s.setBpm);
  const onDigit = useCallback(
    (digit: number) => {
      setTapping(false);
      setEntry((current) => pressNumpadDigit(current, digit, BPM_BOUNDS));
    },
    [setEntry, setTapping],
  );
  const onBackspace = useCallback(() => {
    setTapping(false);
    setEntry(pressNumpadBackspace);
  }, [setEntry, setTapping]);
  const onConfirm = useCallback(() => {
    const typed =
      tapping || entry.untouched
        ? undefined
        : confirmNumpadEntry(entry, BPM_BOUNDS);
    if (typed !== undefined) setBpm(typed);
    onDone();
  }, [tapping, entry, setBpm, onDone]);
  return { onDigit, onBackspace, onConfirm };
}

function useStep(
  { setEntry, setTapping }: EntryState,
  bpm: number | null,
  stepped: (bpm: number) => number,
  onLadder: () => void,
) {
  const setBpm = usePlayAlong((s) => s.setBpm);
  const locked = usePlayAlong((s) => s.lock !== undefined);
  const ladderBpm = useTempoLadder((s) => s.bpm);
  return useCallback(() => {
    if (bpm === null) return;
    const next = stepped(bpm);
    const ladderOwnsTempo = !locked && ladderBpm === bpm;
    setEntry(entryOf(next));
    setTapping(false);
    if (ladderOwnsTempo) onLadder();
    else setBpm(next);
  }, [bpm, stepped, onLadder, setBpm, locked, ladderBpm, setEntry, setTapping]);
}

function tappedTempo(): number | undefined {
  const { bpm, source, tapsLanded } = tempoLadderStore.getState();
  if (tapsLanded < TAPS_TO_SET_TEMPO || source !== BPM_SOURCE.tap) return;
  return bpm ?? undefined;
}

function useSheetTap({ setTapping }: EntryState) {
  const tap = useTempoLadder((s) => s.tap);
  const setBpm = usePlayAlong((s) => s.setBpm);
  const locked = usePlayAlong((s) => s.lock !== undefined);
  return useCallback(
    (event: GestureResponderEvent) => {
      setTapping(true);
      tap(touchedAtBoottimeMs(event));
      const tapped = locked ? tappedTempo() : undefined;
      if (tapped !== undefined) setBpm(tapped);
    },
    [setTapping, tap, locked, setBpm],
  );
}

function useSteps(state: EntryState, bpm: number | null) {
  const halve = useTempoLadder((s) => s.halve);
  const double = useTempoLadder((s) => s.double);
  const onHalve = useStep(state, bpm, halvedBpm, halve);
  const onDouble = useStep(state, bpm, doubledBpm, double);
  const onTap = useSheetTap(state);
  return { onHalve, onDouble, onTap };
}

export function useTempoEntry(onDone: () => void) {
  const bpm = usePlayAlong((s) => s.bpm) ?? null;
  const [wasBpm, setWasBpm] = useState(bpm);
  const [entry, setEntry] = useState(() => entryOf(bpm));
  const [tapping, setTapping] = useState(false);
  const state: EntryState = { entry, setEntry, tapping, setTapping };
  const onShow = useCallback(() => {
    setWasBpm(bpm);
    setEntry(entryOf(bpm));
    setTapping(false);
  }, [bpm]);
  return {
    bpm,
    wasBpm,
    entry,
    tapping,
    onShow,
    ...useKeys(state, onDone),
    ...useSteps(state, bpm),
  };
}
