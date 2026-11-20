import {
  activeSetlistOf,
  indexIn,
  stagePositionOf,
  steppedEntry,
  type SongStep,
} from './setlistPosition.ts';
import type { SetlistEntry } from './snapshot.ts';
import type { LibraryState } from './store.ts';

export interface StepTarget {
  readonly entry: SetlistEntry;
  readonly setlistId: number;
}

type Stage = Pick<LibraryState, 'setlists' | 'entries' | 'loaded'>;

export function stepTarget(
  state: Stage,
  step: SongStep,
  wraps: boolean,
): StepTarget | undefined {
  const active = activeSetlistOf(state.setlists);
  if (active === undefined) return undefined;
  const setlistId = active.setlist.id;
  const entries = state.entries[setlistId] ?? [];
  const position = stagePositionOf(state.loaded, setlistId);
  const entry = steppedEntry(entries, position, step, wraps);
  return entry === undefined ? undefined : { entry, setlistId };
}

export function wasDeleted(state: Stage, target: StepTarget): boolean {
  return indexIn(state.entries[target.setlistId], target.entry.item.id) < 0;
}

export function serialised() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
