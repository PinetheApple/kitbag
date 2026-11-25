import { useMemo } from 'react';

import { queueKeyLabel } from '../queueText.ts';
import type { AppBarAction } from './AppBar.tsx';

export function useQueueBarAction(
  onQueue: (() => void) | null,
  upNextCount: number,
): readonly AppBarAction[] {
  const label = queueKeyLabel(upNextCount);
  return useMemo(
    () =>
      onQueue === null ? [] : [{ icon: 'queue', label, onPress: onQueue }],
    [label, onQueue],
  );
}
