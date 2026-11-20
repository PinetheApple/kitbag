import '@/runtime/cryptoRuntime';
import '@/runtime/metronomeRuntime';
import '@/runtime/libraryRuntime';
import '@/runtime/practiceRuntime';
import '@/runtime/historyPrefsRuntime';
import '@/runtime/songLibraryRuntime';
import '@/runtime/stemDeckRuntime';
import '@/runtime/stemPlayerRuntime';
import '@/runtime/songPlayerRuntime';
import '@/runtime/dataFolderRuntime';
import '@/runtime/tunerRuntime';
import '@/runtime/lastToolRuntime';
import '@/runtime/homeLayoutRuntime';
import '@/runtime/swipeHintRuntime';
import '@/runtime/appearanceRuntime';
import '@/runtime/countInRuntime';
import '@/runtime/standaloneMetronomeRuntime';
import '@/runtime/clickSoundRuntime';
import '@/runtime/backupRuntime';
import '@/runtime/transportRuntime';
import '@/runtime/keepAwakeRuntime';
import '@/runtime/readerFocusRuntime';
import '@/settings/rigRuntime';
import '@/settings/toolsRuntime';

import '@/global.css';

import type { DatabaseOpenError } from '@kitbag/core-db';
import {
  layout,
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
import { VariableContextProvider } from 'nativewind';
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StyleSheet, useColorScheme } from 'react-native';

import { launchDatabaseError } from '@/boot/databaseGate';
import { DatabaseErrorScreen } from '@/boot/DatabaseErrorScreen';
import { resolveThemeMode } from '@/runtime/appearance';
import { applyAppearance } from '@/runtime/appearanceRuntime';
import { useKitbagRuntime } from '@/runtime/bootstrapRuntime';
import { NotificationPromptSheet } from '@/notifications/NotificationPromptSheet';
import { designFonts } from '@/runtime/designFonts';
import { useSongLibraryAnalysis } from '@/runtime/songLibraryRuntime';

void SplashScreen.preventAutoHideAsync();

const CSS_VARIABLES: Readonly<Record<ThemeMode, Record<string, string>>> = {
  dark: themeVars('dark'),
  light: themeVars('light'),
};

export default function RootLayout() {
  useKitbagRuntime();
  const [databaseError] = useState(launchDatabaseError);
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
        <ThemedRoot databaseError={databaseError} />
      </VariableContextProvider>
    </ThemeProvider>
  );
}

interface ThemedRootProps {
  readonly databaseError: DatabaseOpenError | undefined;
}

function ThemedRoot({ databaseError }: ThemedRootProps) {
  const theme = useTheme();
  const rootStyle = useMemo(
    () => [styles.root, { backgroundColor: theme.color.bg }],
    [theme.color.bg],
  );
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: [styles.content, { backgroundColor: theme.color.bg }],
    }),
    [theme.color.bg],
  );

  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider navigationBarTranslucent statusBarTranslucent>
          {databaseError === undefined ? (
            <AppStack screenOptions={screenOptions} />
          ) : (
            <DatabaseErrorScreen error={databaseError} />
          )}
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppStack({
  screenOptions,
}: {
  readonly screenOptions: NonNullable<
    ComponentProps<typeof Stack>['screenOptions']
  >;
}) {
  useSongLibraryAnalysis();
  return (
    <InsetSheetHost>
      <Stack screenOptions={screenOptions} />
      <NotificationPromptSheet />
    </InsetSheetHost>
  );
}

function InsetSheetHost({ children }: { readonly children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <SheetHost topInset={insets.top}>{children}</SheetHost>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
});
