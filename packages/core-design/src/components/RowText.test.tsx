import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ellipsisPaintSize } from '../oneLineFit.ts';
import { rowLineHeight, textRoles } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';

interface HostProps {
  readonly style?: unknown;
  readonly numberOfLines?: number;
  readonly children?: ReactNode;
}

const screen = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    View: ({ children }: HostProps) => <div>{children}</div>,
    Text: ({ style, numberOfLines, children }: HostProps) => (
      <div
        data-node={JSON.stringify({
          lines: numberOfLines,
          style: rn.StyleSheet.flatten(style as never),
        })}
      >
        {children}
      </div>
    ),
    useWindowDimensions: () => ({ fontScale: screen.fontScale }),
  };
});

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));

const { RowText } = await import('./ListRow.tsx');

function textNodes(fontScale: number, bodyLines = false) {
  screen.fontScale = fontScale;
  const markup = renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <RowText title="Title" subtitle="Subtitle" bodyLines={bodyLines} />
    </ThemeProvider>,
  );
  return [...markup.matchAll(/data-node="([^"]*)"/g)].map(
    (match) =>
      JSON.parse((match[1] ?? '{}').replace(/&quot;/g, '"')) as {
        readonly lines?: number;
        readonly style: Readonly<Record<string, unknown>>;
      },
  );
}

describe('RowText', () => {
  it('draws each line as one Text at the default scale', () => {
    const [title, subtitle, ...rest] = textNodes(1);
    expect(rest).toEqual([]);
    expect(title?.lines).toBe(1);
    expect(title?.style.fontSize).toBe(textRoles.rowTitle.size);
    expect(subtitle?.lines).toBe(1);
    expect(subtitle?.style.fontSize).toBe(textRoles.rowSubtitle.size);
  });

  it('reserves the ellipsis on both lines above the default scale', () => {
    const [titleView, title, subtitleView, subtitle] = textNodes(2);
    expect(titleView?.lines).toBe(1);
    expect(titleView?.style.fontSize).toBe(
      ellipsisPaintSize(textRoles.rowTitle.size, 2),
    );
    expect(title?.style.fontSize).toBe(textRoles.rowTitle.size);
    expect(subtitleView?.lines).toBe(1);
    expect(subtitleView?.style.fontSize).toBe(
      ellipsisPaintSize(textRoles.rowSubtitle.size, 2),
    );
    expect(subtitle?.style.fontSize).toBe(textRoles.rowSubtitle.size);
  });

  it('keeps the body line heights on the drawn text', () => {
    const [, title, , subtitle] = textNodes(2, true);
    expect(title?.style.lineHeight).toBe(rowLineHeight.title);
    expect(subtitle?.style.lineHeight).toBe(rowLineHeight.subtitle);
  });
});
