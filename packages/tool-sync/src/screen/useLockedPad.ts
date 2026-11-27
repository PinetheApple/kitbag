import type { PlayAlongLock } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import {
  DRIFT_STATE,
  driftState,
  type DriftStateInputs,
} from '../logic/driftMeter.ts';
import { lockLayout } from '../logic/lockLayout.ts';

export function useLockedPad(
  lock: PlayAlongLock | undefined,
  drift: DriftStateInputs,
) {
  const [retapFor, setRetapFor] = useState<PlayAlongLock | undefined>();
  const [padHeld, setPadHeld] = useState(false);
  const state = driftState(drift);
  const locked = lock !== undefined;
  const drifting = state === DRIFT_STATE.drift;
  const sounding = drifting || state === DRIFT_STATE.locked;
  const retapping = locked && sounding && retapFor === lock;
  const layout = lockLayout({ locked, drifting, retapping, padHeld });
  const onRetap = useCallback(() => {
    setRetapFor(lock);
  }, [lock]);
  const onLanded = useCallback(() => {
    setPadHeld(true);
  }, []);
  const onRelease = useCallback(() => {
    setPadHeld(false);
  }, []);
  return {
    layout,
    retap: drifting || retapping,
    silenced: locked && !sounding,
    onRetap,
    onLanded,
    onRelease,
  };
}
