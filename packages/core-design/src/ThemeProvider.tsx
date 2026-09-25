import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { themes, type Theme } from './theme.ts';
import type { ThemeMode } from './tokens.ts';

const ThemeModeContext = createContext<ThemeMode>('dark');

export interface ThemeProviderProps {
  readonly mode: ThemeMode;
  readonly children: ReactNode;
}

export function ThemeProvider({ mode, children }: ThemeProviderProps) {
  return <ThemeModeContext value={mode}>{children}</ThemeModeContext>;
}

export function useTheme(): Theme {
  return themes[useContext(ThemeModeContext)];
}

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  const byMode = new Map<ThemeMode, T>();
  return function useThemedStyles(): T {
    const theme = useTheme();
    let styles = byMode.get(theme.mode);
    if (styles === undefined) {
      styles = StyleSheet.create(factory(theme));
      byMode.set(theme.mode, styles);
    }
    return styles;
  };
}
