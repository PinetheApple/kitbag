import {
  confirmEntry,
  openEntry,
  pressBackspace,
  pressDigit,
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
  bpm === null ? EMPTY_ENTRY : openEntry(bpm);

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
      setEntry((current) => pressDigit(current, digit, BPM_BOUNDS));
    },
    [setEntry, setTapping],
  );
  const onBackspace = useCallback(() => {
    setTapping(false);
    setEntry(pressBackspace);
  }, [setEntry, setTapping]);
  const onConfirm = useCallback(() => {
    const typed = tapping ? undefined : confirmEntry(entry, BPM_BOUNDS);
    if (typed !== undefined) enter(typed);
    onDone();
  }, [tapping, entry, enter, onDone]);
  return { onDigit, onBackspace, onConfirm };
}

function useSteps({ setEntry, setTapping }: EntryState, bpm: number | null) {
  const tap = useTempoLadder((s) => s.tap);
  const halve = useTempoLadder((s) => s.halve);
  const double = useTempoLadder((s) => s.double);
  const step = useCallback(
    (stepped: (value: number) => number, apply: () => void) => () => {
      if (bpm !== null) setEntry(openEntry(stepped(bpm)));
      setTapping(false);
      apply();
    },
    [bpm, setEntry, setTapping],
  );
  const onTap = useCallback(() => {
    setTapping(true);
    tap(boottimeNowMs());
  }, [setTapping, tap]);
  return {
    onHalve: step(halvedBpm, halve),
    onDouble: step(doubledBpm, double),
    onTap,
  };
}

export function useTempoEntry(onDone: () => void) {
  const bpm = useTempoLadder((s) => s.bpm);
  const [shownBpm, setShownBpm] = useState(bpm);
  const [entry, setEntry] = useState(() => entryOf(bpm));
  const [tapping, setTapping] = useState(false);
  const state: EntryState = { entry, setEntry, tapping, setTapping };
  const onShow = useCallback(() => {
    setShownBpm(bpm);
    setEntry(entryOf(bpm));
    setTapping(false);
  }, [bpm]);
  return {
    bpm,
    shownBpm,
    entry,
    tapping,
    onShow,
    ...useKeys(state, onDone),
    ...useSteps(state, bpm),
  };
}
