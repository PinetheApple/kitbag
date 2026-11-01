import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles },
}));
vi.mock('./ThemeProvider.tsx', async () => {
  const { themes } = await import('./theme.ts');
  return {
    createThemedStyles:
      <T>(factory: (theme: typeof themes.dark) => T) =>
      () =>
        factory(themes.dark),
    useTheme: () => themes.dark,
  };
});
vi.mock('./components/IconGlyph.tsx', () => ({ InlineIcon: 'InlineIcon' }));

const { Button } = await import('./components/Button.tsx');
const { opacity } = await import('./roles.ts');
const { themes } = await import('./theme.ts');

type Props = Readonly<Record<string, unknown>>;

function faceStyle(element: ReactElement<Props>) {
  const face = element.props.children as ReactElement<Props>;
  const layers = (face.props.style as unknown[]).filter(
    (layer): layer is Record<string, unknown> =>
      typeof layer === 'object' && layer !== null,
  );
  return Object.assign({}, ...layers) as Record<string, unknown>;
}

const press = () => undefined;

describe('disabled button', () => {
  it('keeps its outline and dims as a whole when asked to stay outlined', () => {
    const element = Button({
      label: 'Use',
      onPress: press,
      variant: 'primary',
      disabled: true,
      outlinedWhenDisabled: true,
    }) as ReactElement<Props>;
    expect(faceStyle(element)).toMatchObject({
      borderColor: themes.dark.color.line,
      opacity: opacity.muted,
    });
  });

  it('stays undimmed and unoutlined by default', () => {
    const element = Button({
      label: 'Use',
      onPress: press,
      variant: 'primary',
      disabled: true,
    }) as ReactElement<Props>;
    const face = faceStyle(element);
    expect(face.opacity).toBeUndefined();
    expect(face.borderColor).toBe('transparent');
  });
});
