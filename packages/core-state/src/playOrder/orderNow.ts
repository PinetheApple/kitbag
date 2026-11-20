import { libraryStore } from '../library/store.ts';
import { cursorOf, onStageOf, type PlayOrder } from './order.ts';
import { repeatStore, restartedAt } from './repeat.ts';
import { playOrderStore } from './store.ts';

export function playOrderNow(): PlayOrder {
  const library = libraryStore.getState();
  const stage = onStageOf(library);
  return {
    queue: playOrderStore.getState().queue,
    stage,
    cursor: cursorOf(stage, library.loaded),
    restarted: restartedAt(
      repeatStore.getState(),
      stage.setlistId,
      library.loaded,
    ),
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
