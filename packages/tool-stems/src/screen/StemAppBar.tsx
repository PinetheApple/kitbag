import {
  AppBar,
  useQueueBarAction,
  type AppBarAction,
} from '@kitbag/core-design';
import { useStemPlayer, useUpNextCount } from '@kitbag/core-state';
import { useMemo } from 'react';

interface StemAppBarProps {
  readonly onBack: () => void;
  readonly onQueue: (() => void) | null;
  readonly onMenu: (() => void) | null;
}

export function StemAppBar({ onBack, onQueue, onMenu }: StemAppBarProps) {
  const title = useStemPlayer((s) => s.title);
  const artist = useStemPlayer((s) => s.artist);
  const queue = useQueueBarAction(onQueue, useUpNextCount());
  const actions: readonly AppBarAction[] = useMemo(
    () => [
      ...queue,
      ...(onMenu === null
        ? []
        : [{ icon: 'more', label: 'Player menu', onPress: onMenu } as const]),
    ],
    [queue, onMenu],
  );
  return (
    <AppBar
      flush
      title={title === '' ? 'Stems' : title}
      subtitle={artist ?? undefined}
      onBack={onBack}
      actions={actions}
    />
  );
}
