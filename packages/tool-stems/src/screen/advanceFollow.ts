import type { PlayOrderRoutes } from '@kitbag/core-plugin-api';
import {
  ARRIVAL,
  arrivalStore,
  useLibrarySongs,
  useLiveStemPlayer,
  type Arrival,
  type MixerHold,
} from '@kitbag/core-state';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { arrivalText } from '../logic/arrivalText.ts';

// A route change onto the song the store advanced to keeps the screen's hold:
// re-acquiring would reload a song that is already open and playing.
export function useRouteAcquire(
  setId: number,
  acquireSong: (setId: number) => MixerHold,
): () => MixerHold {
  const advancedTo = useLiveStemPlayer((s) => s.advancedTo);
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
  if (arrival.kind === ARRIVAL.metronome) {
    routes.onOpenMetronome();
    return;
  }
  if (arrival.kind === ARRIVAL.gaveUp) return;
  const { song } = arrival;
  if (song.kind === 'song') routes.onOpenSong(song.id);
  else if (song.id !== setId) routes.onOpenStemSet(song.id);
}

export function useArrivalFollow(
  following: boolean,
  setId: number,
  routes: PlayOrderRoutes,
) {
  const library = useLibrarySongs();
  useEffect(() => {
    if (!following) return undefined;
    return arrivalStore.subscribe(({ arrival }, previous) => {
      if (arrival === null || arrival.serial === previous.arrival?.serial)
        return;
      follow(arrival, setId, routes);
      const message = arrivalText(arrival, library);
      if (message !== null) routes.onNotice(message);
    });
  }, [following, setId, routes, library]);
}
