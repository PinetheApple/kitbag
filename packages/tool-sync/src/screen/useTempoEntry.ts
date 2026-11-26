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
  const enter = useTempoLadder((s) => s.enter);
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
    if (typed !== undefined) enter(typed);
    onDone();
  }, [tapping, entry, enter, onDone]);
  return { onDigit, onBackspace, onConfirm };
}

function useSteps({ setEntry, setTapping }: EntryState, bpm: number | null) {
  const tap = useTempoLadder((s) => s.tap);
  const halve = useTempoLadder((s) => s.halve);
  const double = useTempoLadder((s) => s.double);
  const onHalve = useCallback(() => {
    setEntry(entryOf(bpm === null ? null : halvedBpm(bpm)));
    setTapping(false);
    halve();
  }, [bpm, halve, setEntry, setTapping]);
  const onDouble = useCallback(() => {
    setEntry(entryOf(bpm === null ? null : doubledBpm(bpm)));
    setTapping(false);
    double();
  }, [bpm, double, setEntry, setTapping]);
  const onTap = useCallback(() => {
    setTapping(true);
    tap(boottimeNowMs());
  }, [setTapping, tap]);
  return { onHalve, onDouble, onTap };
}

export function useTempoEntry(onDone: () => void) {
  const bpm = useTempoLadder((s) => s.bpm);
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
