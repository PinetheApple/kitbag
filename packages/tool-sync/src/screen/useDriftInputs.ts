import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { useMemo } from 'react';

import type { DriftStateInputs } from '../logic/driftMeter.ts';
import { usePlayAlong } from './playAlongHooks.ts';

export function useDriftInputs(
  session: MediaSessionSnapshot | undefined,
): DriftStateInputs {
  const songAheadOfClickMs = usePlayAlong((s) => s.songAheadOfClickMs);
  const sourceGoneAtMs = usePlayAlong((s) => s.sourceGoneAtBoottimeMs);
  const playing = session?.playing === true;
  return useMemo(
    () => ({ songAheadOfClickMs, playing, sourceGoneAtMs }),
    [songAheadOfClickMs, playing, sourceGoneAtMs],
  );
}
