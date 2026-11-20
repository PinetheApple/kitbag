import { AppBar, queueKeyLabel, type AppBarAction } from '@kitbag/core-design';
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
  const queueLabel = queueKeyLabel(useUpNextCount());
  const actions: readonly AppBarAction[] = useMemo(
    () => [
      ...(onQueue === null
        ? []
        : [{ icon: 'queue', label: queueLabel, onPress: onQueue } as const]),
      ...(onMenu === null
        ? []
        : [{ icon: 'more', label: 'Player menu', onPress: onMenu } as const]),
    ],
    [queueLabel, onQueue, onMenu],
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
