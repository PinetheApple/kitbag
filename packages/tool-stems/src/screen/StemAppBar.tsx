import { AppBar, type AppBarAction } from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useMemo } from 'react';

interface StemAppBarProps {
  readonly onBack: () => void;
  readonly onMenu: (() => void) | null;
}

export function StemAppBar({ onBack, onMenu }: StemAppBarProps) {
  const title = useStemPlayer((s) => s.title);
  const artist = useStemPlayer((s) => s.artist);
  const actions: readonly AppBarAction[] = useMemo(
    () =>
      onMenu === null
        ? []
        : [{ icon: 'more', label: 'Player menu', onPress: onMenu }],
    [onMenu],
  );
  return (
    <AppBar
      edgeToEdge
      title={title === '' ? 'Stems' : title}
      subtitle={artist ?? undefined}
      onBack={onBack}
      actions={actions}
    />
  );
}
