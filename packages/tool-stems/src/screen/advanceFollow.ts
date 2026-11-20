import { arrivalStore, useStemPlayer, useStemSongs } from '@kitbag/core-state';
import { useEffect, useState } from 'react';

import { arrivalText } from '../logic/arrivalText.ts';

// A route change onto the song the store advanced to keeps the screen's hold:
// re-acquiring would reload a song that is already open and playing.
export function useAcquireTarget(setId: number): number {
  const advancedTo = useStemPlayer((s) => s.advancedTo);
  const [route, setRoute] = useState({ setId, held: setId });
  if (route.setId === setId) return route.held;
  const held = setId === advancedTo ? route.held : setId;
  setRoute({ setId, held });
  return held;
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
