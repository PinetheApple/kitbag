import {
  ARRIVAL,
  arrivalStore,
  useStemPlayer,
  useStemSongs,
  type Arrival,
  type MixerHold,
} from '@kitbag/core-state';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { arrivalText } from '../logic/arrivalText.ts';
import type { PlayOrderRoutes } from './usePlayOrderNav.ts';

// A route change onto the song the store advanced to keeps the screen's hold:
// re-acquiring would reload a song that is already open and playing.
export function useRouteAcquire(
  setId: number,
  acquireSong: (setId: number) => MixerHold,
): () => MixerHold {
  const advancedTo = useStemPlayer((s) => s.advancedTo);
  const routeId = useRef(setId);
  useLayoutEffect(() => {
    routeId.current = setId;
  }, [setId]);
  const newRouteAcquirer = () => () => acquireSong(routeId.current);
  const [route, setRoute] = useState(() => ({
    setId,
    acquire: newRouteAcquirer(),
  }));
  if (route.setId === setId) return route.acquire;
  const acquire = setId === advancedTo ? route.acquire : newRouteAcquirer();
  setRoute({ setId, acquire });
  return acquire;
}

function follow(arrival: Arrival, setId: number, routes: PlayOrderRoutes) {
  if (arrival.kind === ARRIVAL.metronome) routes.onOpenMetronome();
  else if (arrival.kind !== ARRIVAL.gaveUp && arrival.stemSetId !== setId)
    routes.onOpenStemSet(arrival.stemSetId);
}

export function useArrivalFollow(setId: number, routes: PlayOrderRoutes) {
  const stems = useStemSongs();
  useEffect(
    () =>
      arrivalStore.subscribe(({ arrival }, previous) => {
        if (arrival === null || arrival.serial === previous.arrival?.serial)
          return;
        follow(arrival, setId, routes);
        const message = arrivalText(arrival, stems);
        if (message !== null) routes.onNotice(message);
      }),
    [setId, routes, stems],
  );
}
