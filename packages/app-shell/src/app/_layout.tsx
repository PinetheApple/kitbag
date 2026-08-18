import '@/global.css';

import { resolveTheme } from '@kitbag/core-design';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { useKitbagRuntime } from '@/runtime/bootstrapRuntime';

const theme = resolveTheme('dark');

// No design in §12 draws a navigation bar; the default header is light and the
// scene default is white, which showed through between screens.
const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: theme.bg },
} as const;

// The root view gesture-handler requires for any handler below it — the
// metronome's swipe-anywhere tempo (#46) is the first (SPEC §5.2).
export default function RootLayout() {
  useKitbagRuntime();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Stack screenOptions={screenOptions} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
});
