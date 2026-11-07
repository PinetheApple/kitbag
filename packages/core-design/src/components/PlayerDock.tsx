import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { View } from 'react-native';

import { size } from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  dock: {
    backgroundColor: theme.color.surface1,
    borderTopWidth: size.stroke,
    borderColor: theme.color.line,
    borderTopLeftRadius: stemPlayer.dockRadius,
    borderTopRightRadius: stemPlayer.dockRadius,
    paddingTop: stemPlayer.dockTop,
    paddingHorizontal: stemPlayer.dockH,
    gap: stemPlayer.dockGap,
  },
}));

export interface PlayerDockProps {
  readonly bottomInset: number;
  readonly children: ReactNode;
}

export function PlayerDock({ bottomInset, children }: PlayerDockProps) {
  const styles = useStyles();
  const padding = useMemo(
    () => ({ paddingBottom: stemPlayer.dockBottom + bottomInset }),
    [bottomInset],
  );
  return <View style={[styles.dock, padding]}>{children}</View>;
}
