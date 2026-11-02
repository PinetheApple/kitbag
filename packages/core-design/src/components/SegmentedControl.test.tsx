import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';

const display = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useWindowDimensions: () => ({ fontScale: display.fontScale }),
}));

const OPTIONS = [
  { value: 'same', label: 'Same' },
  { value: 'distinct', label: 'Distinct' },
] as const;

const ZERO_BASIS_FLEX = 'r-flex-';

function classesAt(fontScale: number, fill: boolean): string[] {
  display.fontScale = fontScale;
  const markup = renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <SegmentedControl
        size="large"
        fill={fill}
        accessibilityLabel="Count-in sound"
        options={OPTIONS}
        selected="same"
        onSelect={vi.fn()}
      />
    </ThemeProvider>,
  );
  const groups = /role="radiogroup" class="([^"]*)"/.exec(markup);
  const options = [...markup.matchAll(/role="radio" [^>]*class="([^"]*)"/g)];
  return [groups?.[1] ?? '', ...options.map((match) => match[1] ?? '')];
}

describe('SegmentedControl under font scale', () => {
  it('shares the track out equally at the default text size', () => {
    for (const classes of classesAt(1, true)) {
      expect(classes).toContain(ZERO_BASIS_FLEX);
    }
  });

  it('sizes the track and each option from its label once the text grows', () => {
    for (const classes of classesAt(2, true)) {
      expect(classes).not.toContain(ZERO_BASIS_FLEX);
      expect(classes).toContain('r-flexGrow-');
    }
  });
});
