import { useEffect, useState } from 'react';

// Once armed and overflowing, a layout stays latched until the layout it
// measured changes, so the two arrangements never alternate.
export function useOverflowLatch(
  layoutKey: string,
  overflowing: boolean,
  armed: boolean,
): boolean {
  const [latchedKey, setLatchedKey] = useState<string | null>(null);
  const latched = latchedKey === layoutKey;
  useEffect(() => {
    if (armed && overflowing && !latched) setLatchedKey(layoutKey);
  }, [armed, overflowing, latched, layoutKey]);
  return latched;
}
