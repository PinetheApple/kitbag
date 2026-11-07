import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { appBarTitleMinSize, textRoles } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';

const screen = vi.hoisted(() => ({ fontScale: 1 }));
const fit = vi.hoisted(() => ({ floor: Number.NaN }));

vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  useWindowDimensions: () => ({ fontScale: screen.fontScale, scale: 1 }),
}));

vi.mock('../useOneLineFit.tsx', () => ({
  useOneLineFit: ({ floor }: { floor: number }) => {
    fit.floor = floor;
    return { style: {}, onAvailableLayout: () => undefined, measurer: null };
  },
}));

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));

const { AppBar } = await import('./AppBar.tsx');

function floorFor(fontScale: number, subtitle?: string): number {
  screen.fontScale = fontScale;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <AppBar title="Long" subtitle={subtitle} />
    </ThemeProvider>,
  );
  return fit.floor;
}

describe('AppBar title floor', () => {
  it('stops at the artist size over an artist line at large text', () => {
    expect(floorFor(2, 'Artist')).toBe(textRoles.appBarSubtitle.size);
  });

  it('keeps the ruled floors with no artist line', () => {
    expect(floorFor(2)).toBe(textRoles.appBarTitle.size / 2);
    expect(floorFor(1)).toBe(appBarTitleMinSize);
  });

  it('keeps the ruled floor over an artist line at the default text size', () => {
    expect(floorFor(1, 'Artist')).toBe(appBarTitleMinSize);
  });
});
