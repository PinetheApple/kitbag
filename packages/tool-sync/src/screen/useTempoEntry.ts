import {
  confirmNumpadEntry,
  openNumpadEntry,
  pressNumpadBackspace,
  pressNumpadDigit,
  type NumpadEntry,
} from '@kitbag/core-design';
import { boottimeNowMs } from '@kitbag/core-native';
import {
  BPM_BOUNDS,
  doubledBpm,
  halvedBpm,
  useTempoLadder,
} from '@kitbag/core-state';
import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { usePlayAlong } from './playAlongHooks.ts';

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
    setEntry(entryOf(stepped(bpm)));
    setTapping(false);
    if (locked || ladderBpm === null) setBpm(stepped(bpm));
    else onLadder();
  }, [bpm, stepped, onLadder, setBpm, locked, ladderBpm, setEntry, setTapping]);
}

function useSteps(state: EntryState, bpm: number | null) {
  const tap = useTempoLadder((s) => s.tap);
  const halve = useTempoLadder((s) => s.halve);
  const double = useTempoLadder((s) => s.double);
  const { setTapping } = state;
  const onHalve = useStep(state, bpm, halvedBpm, halve);
  const onDouble = useStep(state, bpm, doubledBpm, double);
  const onTap = useCallback(() => {
    setTapping(true);
    tap(boottimeNowMs());
  }, [setTapping, tap]);
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
