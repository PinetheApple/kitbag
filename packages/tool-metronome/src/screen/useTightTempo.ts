import { useEffect, useState } from 'react';

// Once the full tempo block overflowed a layout it stays tight until that
// layout changes, so the two blocks never alternate.
export function useTightTempo(
  layoutKey: string,
  overflowing: boolean,
): boolean {
  const [tightKey, setTightKey] = useState<string | null>(null);
  const tight = tightKey === layoutKey;
  useEffect(() => {
    if (!tight && overflowing) setTightKey(layoutKey);
  }, [tight, overflowing, layoutKey]);
  return tight;
}
