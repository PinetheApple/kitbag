import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { compactPadHeight } from '../logic/padFit.ts';

function heightOf(event: LayoutChangeEvent): number {
  return event.nativeEvent.layout.height;
}

export function usePadFit() {
  const [region, setRegion] = useState(0);
  const [slot, setSlot] = useState(0);
  const [bpmCard, setBpmCard] = useState(0);
  const padHeight = compactPadHeight({ region, slot, bpmCard });
  const normal = padHeight === null;
  const onRegion = useCallback((event: LayoutChangeEvent) => {
    setRegion(heightOf(event));
  }, []);
  const onBpmCard = useCallback((event: LayoutChangeEvent) => {
    setBpmCard(heightOf(event));
  }, []);
  const onSlot = useCallback(
    (event: LayoutChangeEvent) => {
      if (normal) setSlot(heightOf(event));
    },
    [normal],
  );
  return { padHeight, onRegion, onSlot, onBpmCard };
}
