import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useCallback: <T>(fn: T) => fn,
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
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
vi.mock('./components/Icon.tsx', () => ({ Icon: 'Icon' }));

const { Switch, SwitchTrack } = await import('./components/Switch.tsx');
const { EditSwitchRow } = await import('./components/EditRow.tsx');
const { switchA11y, switchHitBox } = await import('./switch.ts');

type Props = Readonly<Record<string, unknown>>;

function childTypes(element: ReactElement<Props>): unknown[] {
  const children = element.props.children;
  return (Array.isArray(children) ? children : [children]).map(
    (child: ReactElement) => child.type,
  );
}

describe.each([true, false])('switch components, checked=%s', (value) => {
  it('Switch spreads the a11y state and the hit box for its gaps', () => {
    const gaps = { top: 4, left: 6 };
    const element = Switch({
      value,
      onValueChange: vi.fn(),
      accessibilityLabel: 'Tempo ramp',
      neighbourGapDp: gaps,
    }) as ReactElement<Props>;
    expect(element.type).toBe('Pressable');
    expect(element.props).toMatchObject(switchA11y(value));
    expect(element.props.style).toEqual(switchHitBox(gaps));
    expect(childTypes(element)).toEqual([SwitchTrack]);
  });

  it('EditSwitchRow makes the whole row the switch', () => {
    const element = EditSwitchRow({
      label: 'Haptics',
      value,
      onValueChange: vi.fn(),
    }) as ReactElement<Props>;
    expect(element.type).toBe('Pressable');
    expect(element.props).toMatchObject({
      ...switchA11y(value),
      accessibilityLabel: 'Haptics',
    });
    expect(childTypes(element)).toEqual(['Text', SwitchTrack]);
  });
});
