import { AppBar, createThemedStyles, space } from '@kitbag/core-design';
import { useMemo, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  content: {
    paddingHorizontal: space.screenInset,
    gap: space.sectionGap,
  },
  fillScreen: { flexGrow: 1 },
}));

export interface SettingsFrameProps {
  readonly title: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
  readonly fillScreen?: boolean;
}

export function SettingsFrame({
  title,
  onBack,
  children,
  fillScreen = false,
}: SettingsFrameProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const contentInsets = useMemo(
    () => ({
      paddingTop: space.screenInset + insets.top,
      paddingBottom: space.screenInset + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        contentInsets,
        fillScreen && styles.fillScreen,
      ]}
    >
      <AppBar title={title} onBack={onBack} />
      {children}
    </ScrollView>
  );
}
