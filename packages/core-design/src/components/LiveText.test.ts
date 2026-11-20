import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { expect, it, vi } from 'vitest';

vi.mock('react-native-reanimated', () => ({
  default: { createAnimatedComponent: <T>(component: T) => component },
  useAnimatedProps: (factory: () => unknown) => factory(),
  useAnimatedReaction: () => undefined,
  useSharedValue: <T>(value: T) => ({ value }),
}));
vi.mock('./sheetContentLive.ts', () => ({
  useSheetContentLive: () => ({ value: true }),
}));
vi.mock('../ThemeProvider.tsx', async () => {
  const { themes } = await import('../theme.ts');
  return { useTheme: () => themes.dark };
});

const { LiveText } = await import('./LiveText.tsx');

it('shrinks below the intrinsic width of the input it renders on web', () => {
  const element = LiveText({
    text: { value: 'in 2 bars' } as never,
    role: 'status',
  }) as ReactElement<{ style: unknown }>;
  expect(StyleSheet.flatten(element.props.style as never)).toMatchObject({
    minWidth: 0,
  });
});
