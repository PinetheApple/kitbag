import { createThemedStyles, space } from '@kitbag/core-design';
import { useMemo, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import type { ShellMeasuredInsets } from '../screen/MetronomeScreen.tsx';

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: space.screenInset,
    gap: space.sectionGap,
  },
  content: { gap: space.sectionGap, flexGrow: 1 },
}));

export interface ScreenFrameProps {
  readonly insets: ShellMeasuredInsets;
  readonly header: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export function ScreenFrame({
  insets,
  header,
  footer,
  children,
}: ScreenFrameProps) {
  const styles = useStyles();
  const padding = useMemo(
    () => ({
      paddingTop: space.screenInset + insets.top,
      paddingBottom: space.screenInset + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );
  return (
    <View style={[styles.screen, padding]}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      {footer}
    </View>
  );
}
