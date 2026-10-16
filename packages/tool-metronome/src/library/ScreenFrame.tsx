import { createThemedStyles, EmptyState, space } from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useCallback, useMemo, type ReactNode } from 'react';
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

function LibraryUnavailable() {
  const refresh = useLibrary((s) => s.refresh);
  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);
  return (
    <EmptyState
      icon="warning"
      title="Your songs could not be opened"
      reason="The song library failed to load. The metronome still works."
      actionLabel="Try again"
      onAction={retry}
    />
  );
}

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
  const failed = useLibrary((s) => s.failed);
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
      <ScrollView contentContainerStyle={styles.content}>
        {failed ? <LibraryUnavailable /> : children}
      </ScrollView>
      {footer}
    </View>
  );
}
