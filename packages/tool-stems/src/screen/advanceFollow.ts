import {
  arrivalStore,
  useStemPlayer,
  useStemSongs,
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
  const advancedTo = useStemPlayer((s) => s.advancedTo);
  const routeId = useRef(setId);
  useLayoutEffect(() => {
    routeId.current = setId;
  }, [setId]);
  const fresh = () => () => acquireSong(routeId.current);
  const [route, setRoute] = useState(() => ({ setId, acquire: fresh() }));
  if (route.setId === setId) return route.acquire;
  const acquire = setId === advancedTo ? route.acquire : fresh();
  setRoute({ setId, acquire });
  return acquire;
}

export function useArrivalFollow(
  setId: number,
  onOpenStemSet: (stemSetId: number) => void,
  showMessage: (message: string) => void,
) {
  const stems = useStemSongs();
  useEffect(
    () =>
      arrivalStore.subscribe(({ arrival }, previous) => {
        if (arrival === null || arrival.serial === previous.arrival?.serial)
          return;
        const { stemSetId } = arrival;
        if (stemSetId !== null && stemSetId !== setId) onOpenStemSet(stemSetId);
        const message = arrivalText(arrival, stems);
        if (message !== null) showMessage(message);
      }),
    [setId, onOpenStemSet, showMessage, stems],
  );
}
