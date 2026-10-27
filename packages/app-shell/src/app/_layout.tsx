import '@/runtime/cryptoRuntime';
import '@/runtime/metronomeRuntime';
import '@/runtime/libraryRuntime';
import '@/runtime/songLibraryRuntime';
import '@/runtime/tunerRuntime';
import '@/runtime/lastToolRuntime';
import '@/runtime/transportRuntime';

import '@/global.css';

import { SheetHost, ThemeProvider, useTheme } from '@kitbag/core-design';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { StyleSheet, useColorScheme } from 'react-native';

import { useKitbagRuntime } from '@/runtime/bootstrapRuntime';
import { designFonts } from '@/runtime/designFonts';
import { useSongLibraryAnalysis } from '@/runtime/songLibraryRuntime';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useKitbagRuntime();
  useSongLibraryAnalysis();
  const [fontsLoaded, fontError] = useFonts(designFonts);
  const fontsSettled = fontsLoaded || fontError !== null;
  const mode = useColorScheme() === 'light' ? 'light' : 'dark';

  useEffect(() => {
    if (fontsSettled) void SplashScreen.hideAsync();
  }, [fontsSettled]);

  if (!fontsSettled) return null;

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
        <KeyboardProvider navigationBarTranslucent statusBarTranslucent>
          <SheetHost>
            <Stack screenOptions={screenOptions} />
          </SheetHost>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
