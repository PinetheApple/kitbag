import { AppBar, createThemedStyles, space } from '@kitbag/core-design';
import { useMemo, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.screenInset,
    paddingTop: space.screenInset,
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
  const frameInset = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  const contentInset = useMemo(
    () => ({ paddingBottom: space.screenInset + insets.bottom }),
    [insets.bottom],
  );
  return (
    <View style={[styles.screen, frameInset]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          contentInset,
          fillScreen && styles.fillScreen,
        ]}
      >
        <AppBar title={title} onBack={onBack} />
        {children}
      </ScrollView>
    </View>
  );
}
