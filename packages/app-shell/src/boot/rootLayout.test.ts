import { DatabaseOpenError } from '@kitbag/core-db';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = vi.hoisted(() => ({
  databaseError: undefined as DatabaseOpenError | undefined,
  rendered: [] as string[],
  stackOptions: undefined as { readonly contentStyle?: unknown } | undefined,
  passThrough: ({ children }: { readonly children?: ReactNode }) => children,
}));

vi.mock('@/runtime/cryptoRuntime', () => ({}));
vi.mock('@/runtime/metronomeRuntime', () => ({}));
vi.mock('@/runtime/libraryRuntime', () => ({}));
vi.mock('@/runtime/practiceRuntime', () => ({}));
vi.mock('@/runtime/historyPrefsRuntime', () => ({}));
vi.mock('@/runtime/stemDeckRuntime', () => ({}));
vi.mock('@/runtime/stemPlayerRuntime', () => ({}));
vi.mock('@/runtime/songPlayerRuntime', () => ({}));
vi.mock('@/runtime/dataFolderRuntime', () => ({}));
vi.mock('@/runtime/tunerRuntime', () => ({}));
vi.mock('@/runtime/mediaSessionsRuntime', () => ({}));
vi.mock('@/runtime/lastToolRuntime', () => ({}));
vi.mock('@/runtime/homeLayoutRuntime', () => ({}));
vi.mock('@/runtime/swipeHintRuntime', () => ({}));
vi.mock('@/runtime/repeatHintRuntime', () => ({}));
vi.mock('@/runtime/countInRuntime', () => ({}));
vi.mock('@/runtime/standaloneMetronomeRuntime', () => ({}));
vi.mock('@/runtime/clickSoundRuntime', () => ({}));
vi.mock('@/runtime/backupRuntime', () => ({}));
vi.mock('@/runtime/transportRuntime', () => ({}));
vi.mock('@/runtime/keepAwakeRuntime', () => ({}));
vi.mock('@/runtime/readerFocusRuntime', () => ({}));
vi.mock('@/settings/rigRuntime', () => ({}));
vi.mock('@/settings/toolsRuntime', () => ({}));
vi.mock('@/global.css', () => ({}));

vi.mock('@kitbag/core-design', () => ({
  contentColumnStyle: { maxWidth: 'column cap' },
  SheetHost: root.passThrough,
  ThemeProvider: root.passThrough,
  themeVars: () => ({}),
  useTheme: () => ({ color: { bg: 'bg' } }),
}));
vi.mock('@kitbag/core-state', () => ({
  useAppearance: (select: (state: { theme: string }) => unknown) =>
    select({ theme: 'system' }),
}));
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock('expo-router', () => ({
  Stack: (props: { readonly screenOptions?: { contentStyle?: unknown } }) => {
    root.rendered.push('Stack');
    root.stackOptions = props.screenOptions;
    return null;
  },
}));
vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => Promise.resolve(),
}));
vi.mock('nativewind', () => ({ VariableContextProvider: root.passThrough }));
vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: root.passThrough,
}));
vi.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: root.passThrough,
}));
vi.mock('react-native-safe-area-context', () => ({
  initialWindowMetrics: null,
  SafeAreaProvider: root.passThrough,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('react-native', () => ({
  StyleSheet: { create: <T>(styles: T) => styles },
  useColorScheme: () => 'dark',
}));
vi.mock('@/runtime/appearance', () => ({ resolveThemeMode: () => 'dark' }));
vi.mock('@/runtime/appearanceRuntime', () => ({
  applyAppearance: () => undefined,
}));
vi.mock('@/runtime/bootstrapRuntime', () => ({
  useKitbagRuntime: () => undefined,
}));
vi.mock('@/runtime/designFonts', () => ({ designFonts: {} }));
vi.mock('@/runtime/songLibraryRuntime', () => ({
  useSongLibraryAnalysis: () => {
    root.rendered.push('library analysis');
  },
}));
vi.mock('@/notifications/NotificationPromptSheet', () => ({
  NotificationPromptSheet: () => null,
}));
vi.mock('@/boot/databaseGate', () => ({
  launchDatabaseError: () => root.databaseError,
}));
vi.mock('@/boot/DatabaseErrorScreen', () => ({
  DatabaseErrorScreen: ({ error }: { readonly error: DatabaseOpenError }) => {
    root.rendered.push(`database error: ${error.kind}`);
    return null;
  },
}));

const { default: RootLayout } = await import('../app/_layout.tsx');

function renderRoot(): readonly string[] {
  root.rendered.length = 0;
  renderToStaticMarkup(createElement(RootLayout));
  return [...root.rendered];
}

beforeEach(() => {
  root.databaseError = undefined;
});

describe('root layout', () => {
  it('blocks the app with the error screen when the database did not open', () => {
    root.databaseError = new DatabaseOpenError('newer-version');

    expect(renderRoot()).toEqual(['database error: newer-version']);
  });

  it('renders the app, library analysis included, when the database opened', () => {
    expect(renderRoot()).toEqual(['library analysis', 'Stack']);
  });

  it('lays every screen out in the shared capped content column', () => {
    renderRoot();

    expect(root.stackOptions?.contentStyle).toContainEqual({
      maxWidth: 'column cap',
    });
  });
});
