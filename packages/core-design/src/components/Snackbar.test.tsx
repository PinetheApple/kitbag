import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { snackbar } from '../snackbarRoles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { Snackbar, type SnackbarProps } from './Snackbar.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const bars = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const View = actual.View as (props: Props) => ReactNode;
  return {
    ...actual,
    View: (props: Props) => {
      if (props.accessibilityRole === 'alert') bars.push(props);
      return createElement(View, props);
    },
  };
});

const { StyleSheet } = await import('react-native');

const FLOATING_BOTTOM = 96;

function barStyle(placement: Pick<SnackbarProps, 'bottom' | 'inline'>) {
  bars.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Snackbar
        message="Saved"
        onTimeout={vi.fn()}
        {...(placement as { bottom: number })}
      />
    </ThemeProvider>,
  );
  return StyleSheet.flatten(bars[0]?.style as StyleProp<ViewStyle>);
}

describe('Snackbar placement', () => {
  it('floats at the bottom it is given', () => {
    expect(barStyle({ bottom: FLOATING_BOTTOM })).toMatchObject({
      position: 'absolute',
      bottom: FLOATING_BOTTOM,
    });
  });

  it('sits in the flow above a sheet when inline', () => {
    const style = barStyle({ inline: true });
    expect(style).toMatchObject({
      position: 'relative',
      marginHorizontal: snackbar.sheetSideInset,
      marginBottom: snackbar.aboveSheet,
    });
    expect(style.bottom).toBeUndefined();
  });
});

describe('Snackbar speech', () => {
  function markup(props: Partial<SnackbarProps>) {
    return renderToStaticMarkup(
      <ThemeProvider mode="dark">
        <Snackbar
          message="Tempo set to ×3/2 · 156 BPM."
          onTimeout={vi.fn()}
          bottom={FLOATING_BOTTOM}
          {...(props as { spokenMessage?: string })}
        />
      </ThemeProvider>,
    );
  }

  it('speaks the spoken message in place of the shown one', () => {
    expect(
      markup({ spokenMessage: 'Tempo set to one and a half times, 156 BPM.' }),
    ).toContain('aria-label="Tempo set to one and a half times, 156 BPM."');
  });

  it('speaks the shown message when there is no spoken one', () => {
    expect(markup({})).toContain('aria-label="Tempo set to ×3/2 · 156 BPM."');
  });
});
