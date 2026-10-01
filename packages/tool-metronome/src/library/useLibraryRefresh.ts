import { useLibrary } from '@kitbag/core-state';
import { useEffect } from 'react';

export function useLibraryRefresh(): void {
  const refresh = useLibrary((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
}
