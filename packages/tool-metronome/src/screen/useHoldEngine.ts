import { useMetronome } from '@kitbag/core-state';
import { useEffect } from 'react';

export function useHoldEngine(active = true): void {
  const holdEngine = useMetronome((state) => state.holdEngine);
  useEffect(() => (active ? holdEngine() : undefined), [active, holdEngine]);
}
