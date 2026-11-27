import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { compactPadHeight } from '../logic/padFit.ts';

function heightOf(event: LayoutChangeEvent): number {
  return event.nativeEvent.layout.height;
}

function bottomOf(event: LayoutChangeEvent): number {
  const { y, height } = event.nativeEvent.layout;
  return y + height;
}

export function usePadFit() {
  const [region, setRegion] = useState(0);
  const [slot, setSlot] = useState(0);
  const [bpmCardBottom, setBpmCardBottom] = useState(0);
  const padHeight = compactPadHeight({ region, slot, bpmCardBottom });
  const normal = padHeight === null;
  const onRegion = useCallback((event: LayoutChangeEvent) => {
    setRegion(heightOf(event));
  }, []);
  const onBpmCard = useCallback((event: LayoutChangeEvent) => {
    setBpmCardBottom(bottomOf(event));
  }, []);
  const onSlot = useCallback(
    (event: LayoutChangeEvent) => {
      if (normal) setSlot(heightOf(event));
    },
    [normal],
  );
  return { padHeight, onRegion, onSlot, onBpmCard };
}
