import { useEffect } from 'react';

import { useMetronome } from './useMetronome.ts';

export function useHoldEngine(active = true): void {
  const holdEngine = useMetronome((state) => state.holdEngine);
  useEffect(() => (active ? holdEngine() : undefined), [active, holdEngine]);
}
