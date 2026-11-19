import { useCallback, useMemo, useRef } from 'react';

export function useAfterSheetClosed() {
  const pending = useRef<(() => void) | null>(null);
  const after = useCallback((then: () => void) => {
    pending.current = then;
  }, []);
  const closed = useCallback(() => {
    const then = pending.current;
    pending.current = null;
    then?.();
  }, []);
  return useMemo(() => ({ after, closed }), [after, closed]);
}
