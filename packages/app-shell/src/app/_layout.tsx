import '@/runtime/metronomeRuntime';

import '@/global.css';

import { ThemeProvider, useTheme } from '@kitbag/core-design';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { StyleSheet, useColorScheme } from 'react-native';

import { useKitbagRuntime } from '@/runtime/bootstrapRuntime';

export default function RootLayout() {
  useKitbagRuntime();
  const mode = useColorScheme() === 'light' ? 'light' : 'dark';

  return (
    <ThemeProvider mode={mode}>
      <ThemedRoot />
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const theme = useTheme();
  const rootStyle = useMemo(
    () => [styles.root, { backgroundColor: theme.color.bg }],
    [theme.color.bg],
  );
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: theme.color.bg },
    }),
    [theme.color.bg],
  );

  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Stack screenOptions={screenOptions} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
