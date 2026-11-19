import { EXPORT_POLL_MS, percentOf, useStemPlayer } from '@kitbag/core-state';
import { useEffect, useState } from 'react';

export function useMixdownProgress(polling: boolean): number {
  const exportProgress = useStemPlayer((s) => s.exportProgress);
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    if (!polling) return undefined;
    const read = () => {
      setPercent(percentOf(exportProgress()));
    };
    read();
    const timer = setInterval(read, EXPORT_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [polling, exportProgress]);
  return percent;
}
