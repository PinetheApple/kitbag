import { useEffect } from 'react';

import { snackbarTimeLeftMs } from '../snackbarTimeLeft.ts';
import { useVisibleSince } from '../useVisibleSince.ts';
import { Snackbar } from './Snackbar.tsx';

type Place =
  | { readonly bottom: number; readonly inline?: never }
  | { readonly inline: true; readonly bottom?: never };

export type TimedSnackbarProps = Place & {
  readonly at: number;
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly onTimeout: () => void;
};

export function useSnackbarShown(at: number | undefined): boolean {
  const visibleSince = useVisibleSince();
  return at !== undefined && snackbarTimeLeftMs(at, visibleSince) > 0;
}

export function TimedSnackbar({ at, onTimeout, ...rest }: TimedSnackbarProps) {
  const visibleSince = useVisibleSince();
  const timeLeftMs = snackbarTimeLeftMs(at, visibleSince);
  const expired = timeLeftMs <= 0;
  useEffect(() => {
    if (expired) onTimeout();
  }, [expired, onTimeout]);
  if (expired) return null;
  return (
    <Snackbar
      key={`${String(at)}-${String(visibleSince)}`}
      {...rest}
      durationMs={timeLeftMs}
      onTimeout={onTimeout}
    />
  );
}
