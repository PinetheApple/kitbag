import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ellipsisPaintSize } from '../oneLineFit.ts';

interface HostProps {
  readonly style?: unknown;
  readonly numberOfLines?: number;
  readonly ellipsizeMode?: string;
  readonly children?: ReactNode;
}

const screen = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Text: ({ style, numberOfLines, ellipsizeMode, children }: HostProps) => (
      <div
        data-node={JSON.stringify({
          lines: numberOfLines,
          ellipsis: ellipsizeMode,
          style: rn.StyleSheet.flatten(style as never),
        })}
      >
        {children}
      </div>
    ),
    useWindowDimensions: () => ({ fontScale: screen.fontScale }),
  };
});

const { EllipsizedLine } = await import('./EllipsizedLine.tsx');

const FONT_SIZE = 15;
const LINE_HEIGHT = 20;
const LINES = 3;
const STYLE = { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT };

function textNodes(fontScale: number, numberOfLines?: number, children = 'A') {
  screen.fontScale = fontScale;
  const markup = renderToStaticMarkup(
    <EllipsizedLine style={STYLE} numberOfLines={numberOfLines}>
      {children}
    </EllipsizedLine>,
  );
  return [...markup.matchAll(/data-node="([^"]*)"/g)].map(
    (match) =>
      JSON.parse((match[1] ?? '{}').replace(/&quot;/g, '"')) as {
        readonly lines?: number;
        readonly ellipsis?: string;
        readonly style: Readonly<Record<string, unknown>>;
      },
  );
}

describe('EllipsizedLine', () => {
  it('holds one line unless told otherwise', () => {
    expect(textNodes(1)[0]?.lines).toBe(1);
    expect(textNodes(2)[0]?.lines).toBe(1);
  });

  it('stays one plain Text at the default scale, whatever the limit', () => {
    expect(textNodes(1, LINES)).toEqual([
      { lines: LINES, ellipsis: 'tail', style: STYLE },
    ]);
  });

  it('puts the limit and the reserve on the view above the default scale', () => {
    const [view, text] = textNodes(2, LINES);
    expect(view?.lines).toBe(LINES);
    expect(view?.ellipsis).toBe('tail');
    expect(view?.style.fontSize).toBe(ellipsisPaintSize(FONT_SIZE, 2));
    expect(text?.lines).toBeUndefined();
    expect(text?.style).toEqual(STYLE);
  });

  it('keeps an empty line a plain Text above the default scale', () => {
    expect(textNodes(2, LINES, '')).toHaveLength(1);
  });
});
