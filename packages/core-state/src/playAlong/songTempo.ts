import type { StoreAccess } from '../configuredStore.ts';
import { DEFAULT_BPM } from '../metronome/store.ts';
import { sameSong } from '../tempoLadder/store.ts';
import { chosenSession } from './libraryOffer.ts';
import type { LockedView } from './lockedView.ts';
import type { FollowedLadder, PlayAlongRuntime } from './runtime.ts';
import { songOf, trackOf, type PlayAlongTrack } from './track.ts';

type LadderView = ReturnType<FollowedLadder['getState']>;

interface Applied {
  readonly track: PlayAlongTrack | undefined;
}

const sameIdentity = (
  a: PlayAlongTrack | undefined,
  b: PlayAlongTrack | undefined,
) =>
  a?.title === b?.title &&
  a?.artist === b?.artist &&
  a?.durationMs === b?.durationMs;

export function songTempo(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<LockedView>,
  showBpm: (bpm: number) => void,
) {
  let watching = false;
  let applied: Applied | undefined;

  const apply = (bpm: number | null) => {
    if (bpm === null) setState({ bpm: undefined });
    else if (bpm !== getState().bpm) showBpm(bpm);
  };

  const onLadder = (state: LadderView, previous: LadderView) => {
    if (state.bpm === previous.bpm || getState().lock !== undefined) return;
    const seen = chosenSession(runtime);
    if (seen === undefined) {
      if (state.bpm !== null) apply(state.bpm);
    } else if (sameSong(state.track, songOf(seen))) apply(state.bpm);
  };

  const resync = () => {
    if (!watching || getState().lock !== undefined) return;
    const seen = chosenSession(runtime);
    const track = seen && trackOf(seen);
    if (applied !== undefined && sameIdentity(applied.track, track)) return;
    applied = { track };
    if (seen === undefined) {
      if (getState().bpm === undefined) setState({ bpm: DEFAULT_BPM });
      return;
    }
    const ladder = runtime.ladder().getState();
    apply(sameSong(ladder.track, songOf(seen)) ? ladder.bpm : null);
  };

  const watch = () => {
    watching = true;
    applied = undefined;
    const stopLadder = runtime.ladder().subscribe(onLadder);
    const stopSessions = runtime.sessions().subscribe(resync);
    resync();
    return () => {
      watching = false;
      stopLadder();
      stopSessions();
    };
  };

  return { watch, resync };
}
