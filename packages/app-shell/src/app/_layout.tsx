import '@/runtime/cryptoRuntime';
import '@/runtime/metronomeRuntime';
import '@/runtime/libraryRuntime';
import '@/runtime/songLibraryRuntime';
import '@/runtime/stemPlayerRuntime';
import '@/runtime/tunerRuntime';
import '@/runtime/lastToolRuntime';
import '@/runtime/swipeHintRuntime';
import '@/runtime/appearanceRuntime';
import '@/runtime/transportRuntime';
import '@/runtime/keepAwakeRuntime';

import '@/global.css';

import {
  SheetHost,
  ThemeProvider,
  themeVars,
  useTheme,
  type ThemeMode,
} from '@kitbag/core-design';
import { useAppearance } from '@kitbag/core-state';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { VariableContextProvider } from 'nativewind';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { StyleSheet, useColorScheme } from 'react-native';

import { resolveThemeMode, statusBarStyle } from '@/runtime/appearance';
import { applyAppearance } from '@/runtime/appearanceRuntime';
import { useKitbagRuntime } from '@/runtime/bootstrapRuntime';
import { designFonts } from '@/runtime/designFonts';
import { useSongLibraryAnalysis } from '@/runtime/songLibraryRuntime';

void SplashScreen.preventAutoHideAsync();

const CSS_VARIABLES: Readonly<Record<ThemeMode, Record<string, string>>> = {
  dark: themeVars('dark'),
  light: themeVars('light'),
};

export default function RootLayout() {
  useKitbagRuntime();
  useSongLibraryAnalysis();
  const [fontsLoaded, fontError] = useFonts(designFonts);
  const fontsSettled = fontsLoaded || fontError !== null;
  const themeChoice = useAppearance((s) => s.theme);
  const mode = resolveThemeMode(themeChoice, useColorScheme());

  useEffect(() => {
    applyAppearance(themeChoice, mode);
  }, [themeChoice, mode]);

  useEffect(() => {
    if (fontsSettled) void SplashScreen.hideAsync();
  }, [fontsSettled]);

  if (!fontsSettled) return null;

  return (
    <ThemeProvider mode={mode}>
      <VariableContextProvider value={CSS_VARIABLES[mode]}>
        <StatusBar style={statusBarStyle(mode)} />
        <ThemedRoot />
      </VariableContextProvider>
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
