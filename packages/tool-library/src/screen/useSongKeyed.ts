import { useCallback, useState } from 'react';

interface Kept<T> {
  readonly songId: number;
  readonly value: T;
}

export function useSongKeyed<T>(
  songId: number,
  initial: T,
): readonly [T, (value: T) => void] {
  const [kept, setKept] = useState<Kept<T>>({ songId, value: initial });
  const set = useCallback(
    (value: T) => {
      setKept({ songId, value });
    },
    [songId],
  );
  return [kept.songId === songId ? kept.value : initial, set] as const;
}
