import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { flaggedEighthGeometry } from '../notation.ts';
import { themes } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import type { ColorToken, ThemeMode } from '../tokens.ts';
import { NotationGlyph } from './NotationGlyph.tsx';

const CHIP_HEIGHT = 24;
const SUBDIVISIONS = Array.from({ length: 16 }, (_u, i) => i + 1);

function render(
  subdivision: number,
  denominator: number,
  mode: ThemeMode = 'dark',
  color?: ColorToken,
): string {
  const glyph = { subdivision, denominator, height: CHIP_HEIGHT };
  return renderToStaticMarkup(
    <ThemeProvider mode={mode}>
      <NotationGlyph {...(color === undefined ? glyph : { ...glyph, color })} />
    </ThemeProvider>,
  );
}

describe('NotationGlyph', () => {
  it('draws the flagged eighth as svg for one click per beat in x/8', () => {
    const markup = render(1, 8);
    expect(markup).toContain('<svg');
    expect(markup).toContain('<ellipse');
    expect(markup).toContain('<rect');
    expect(markup).toContain(`<path d="${flaggedEighthGeometry.flagPath}">`);
  });

  it('keeps svg out of every other denominator and subdivision', () => {
    const drawnWithSvg = [2, 4, 8].flatMap((denominator) =>
      SUBDIVISIONS.filter((n) => render(n, denominator).includes('<svg')).map(
        (n) => `${String(n)}/${String(denominator)}`,
      ),
    );
    expect(drawnWithSvg).toEqual(['1/8']);
  });

  it.each([
    { mode: 'dark', color: 'text' },
    { mode: 'light', color: 'text' },
    { mode: 'dark', color: 'text2' },
    { mode: 'light', color: 'text2' },
  ] as const)('fills with the $color token in $mode', ({ mode, color }) => {
    expect(render(1, 8, mode, color)).toContain(
      `fill="${themes[mode].color[color]}"`,
    );
  });

  it('defaults to the text token', () => {
    expect(render(1, 8, 'light')).toContain(
      `fill="${themes.light.color.text}"`,
    );
  });
});
