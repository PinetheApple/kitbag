import { useCallback, useState } from 'react';

export type SetNotice = (notice: string | null) => void;

export interface Notice {
  readonly notice: string | null;
  readonly setNotice: SetNotice;
  readonly clearNotice: () => void;
}

export function useNotice(): Notice {
  const [notice, setNotice] = useState<string | null>(null);
  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);
  return { notice, setNotice, clearNotice };
}
