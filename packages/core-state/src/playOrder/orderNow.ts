import { libraryStore } from '../library/store.ts';
import { cursorOf, onStageOf, type PlayOrder } from './order.ts';
import { repeatStore } from './repeat.ts';
import { roundNow } from './repeatWrap.ts';
import { playOrderStore } from './store.ts';

export function playOrderNow(): PlayOrder {
  const library = libraryStore.getState();
  const stage = onStageOf(library);
  return {
    queue: playOrderStore.getState().queue,
    stage,
    cursor: cursorOf(stage, library.loaded),
    round: roundNow(),
  };
}

export function subscribePlayOrder(listener: () => void): () => void {
  const stops = [
    playOrderStore.subscribe(listener),
    libraryStore.subscribe(listener),
    repeatStore.subscribe(listener),
  ];
  return () => {
    stops.forEach((stop) => {
      stop();
    });
  };
}
