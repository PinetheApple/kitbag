import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { libraryMix } from '../libraryRoles.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(theme.color.text, libraryMix.selectedRow),
  },
}));

export interface MenuOpenTintProps {
  readonly visible: boolean | undefined;
  readonly radius: number;
}

export function MenuOpenTint({ visible, radius }: MenuOpenTintProps) {
  const styles = useStyles();
  const corner = useMemo(() => ({ borderRadius: radius }), [radius]);
  if (visible !== true) return null;
  return <View pointerEvents="none" style={[styles.tint, corner]} />;
}
