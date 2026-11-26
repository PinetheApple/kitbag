import type { StoreAccess } from '../configuredStore.ts';
import { DEFAULT_BPM } from '../metronome/store.ts';
import { sameSong } from '../tempoLadder/store.ts';
import { chosenSession } from './libraryOffer.ts';
import type { FollowedLadder, PlayAlongRuntime } from './runtime.ts';
import { songOf } from './track.ts';

type TempoAccess = StoreAccess<{
  readonly bpm: number | undefined;
  readonly lock: object | undefined;
}>;

type LadderView = ReturnType<FollowedLadder['getState']>;

export const startingBpm = (runtime: PlayAlongRuntime) =>
  chosenSession(runtime) === undefined ? DEFAULT_BPM : undefined;

export function songTempo(
  runtime: PlayAlongRuntime,
  { getState, setState }: TempoAccess,
  setBpm: (bpm: number) => void,
  songShown: () => void,
) {
  const apply = (bpm: number | null) => {
    if (bpm === null) {
      if (chosenSession(runtime) !== undefined) setState({ bpm: undefined });
    } else if (bpm !== getState().bpm) setBpm(bpm);
  };

  const onLadder = (state: LadderView, previous: LadderView) => {
    if (state.bpm !== previous.bpm) apply(state.bpm);
  };

  const onSessions = () => {
    const seen = chosenSession(runtime);
    if (seen === undefined) {
      if (getState().bpm === undefined) setState({ bpm: DEFAULT_BPM });
      return;
    }
    songShown();
    const { track, bpm } = runtime.ladder().getState();
    if (getState().lock === undefined && sameSong(track, songOf(seen)))
      apply(bpm);
  };

  return () => {
    const stopLadder = runtime.ladder().subscribe(onLadder);
    const stopSessions = runtime.sessions().subscribe(onSessions);
    onSessions();
    return () => {
      stopLadder();
      stopSessions();
    };
  };
}
