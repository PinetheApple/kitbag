import { ADVANCE_CAUSE, type SongEnds } from './songEnd.ts';

export type PreviousListener = (inApp: boolean) => void;

function previousPresses(session: () => number) {
  const listeners = new Set<PreviousListener>();
  return {
    pressed: (pressedIn: number, inApp = false) => {
      if (pressedIn !== session()) return;
      listeners.forEach((listener) => {
        listener(inApp);
      });
    },
    subscribe: (listener: PreviousListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function cardPresses(session: () => number, ends: SongEnds) {
  const previous = previousPresses(session);
  return {
    requests: { next: ends.pressedNext, previous: previous.pressed },
    actions: {
      pressNext: () => {
        ends.pressedNext(session(), ADVANCE_CAUSE.nextInApp);
      },
      pressNextPaused: () => {
        ends.pressedNext(session(), ADVANCE_CAUSE.nextPaused);
      },
      pressPrevious: () => {
        previous.pressed(session(), true);
      },
      onPrevious: previous.subscribe,
    },
  };
}

export type CardPressActions = ReturnType<typeof cardPresses>['actions'];
