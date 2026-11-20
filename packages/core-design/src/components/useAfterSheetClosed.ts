import { useCallback, useEffect, useMemo, useRef } from 'react';

export function useAfterSheetClosed(visible: boolean) {
  const pending = useRef<(() => void) | null>(null);
  const shut = useRef(!visible);
  useEffect(() => {
    if (!visible) return;
    pending.current = null;
    shut.current = false;
  }, [visible]);
  const after = useCallback((then: () => void) => {
    if (shut.current) then();
    else pending.current = then;
  }, []);
  const closed = useCallback(() => {
    shut.current = true;
    const then = pending.current;
    pending.current = null;
    then?.();
  }, []);
  return useMemo(() => ({ after, closed }), [after, closed]);
}
