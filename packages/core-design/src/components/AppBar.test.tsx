import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  appBarTitleMinSize,
  iconSizes,
  screenBar,
  space,
  textRoles,
} from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp, type ThemeMode } from '../tokens.ts';

interface HostProps {
  readonly style?: unknown;
  readonly accessibilityRole?: string;
  readonly accessibilityLabel?: string;
  readonly numberOfLines?: number;
  readonly minimumFontScale?: number;
  readonly children?: ReactNode;
}

const screen = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  const host = (kind: string) =>
    function Host({
      style,
      accessibilityRole,
      accessibilityLabel,
      numberOfLines,
      minimumFontScale,
      children,
    }: HostProps) {
      return (
        <div
          data-node={JSON.stringify({
            kind,
            role: accessibilityRole,
            label: accessibilityLabel,
            lines: numberOfLines,
            minScale: minimumFontScale,
            style: rn.StyleSheet.flatten(style as never),
          })}
        >
          {children}
        </div>
      );
    };
  return {
    ...rn,
    View: host('view'),
    Pressable: host('press'),
    Text: host('text'),
    useWindowDimensions: () => ({
      ...rn.useWindowDimensions(),
      fontScale: screen.fontScale,
    }),
  };
});

vi.mock('./IconGlyph.tsx', () => ({
  IconGlyph: ({ name, px }: { name: string; px: number }) => (
    <i data-node={JSON.stringify({ kind: 'icon', label: name, px })} />
  ),
}));

const { AppBar } = await import('./AppBar.tsx');

const noop = () => undefined;
const MODES: readonly ThemeMode[] = ['light', 'dark'];

interface Node {
  readonly kind: string;
  readonly role?: string;
  readonly label?: string;
  readonly px?: number;
  readonly lines?: number;
  readonly minScale?: number;
  readonly style?: Readonly<Record<string, unknown>>;
  readonly at: number;
}

const QUOT = /&quot;/g;
const AMP = /&amp;/g;

function render(bar: ReactElement, mode: ThemeMode = 'dark'): string {
  return renderToStaticMarkup(<ThemeProvider mode={mode}>{bar}</ThemeProvider>);
}

function nodes(markup: string): Node[] {
  return [...markup.matchAll(/data-node="([^"]*)"/g)].map((match) => ({
    ...(JSON.parse(
      (match[1] ?? '{}').replace(QUOT, '"').replace(AMP, '&'),
    ) as Omit<Node, 'at'>),
    at: match.index,
  }));
}

function buttons(markup: string): Node[] {
  return nodes(markup).filter((n) => n.role === 'button');
}

function button(markup: string, label: string): Node {
  const found = buttons(markup).find((b) => b.label === label);
  if (found === undefined) throw new Error(`no button labelled ${label}`);
  return found;
}

function iconIn(markup: string, key: Node): Node | undefined {
  const next = nodes(markup).find((n) => n.at > key.at && n.kind === 'icon');
  const between = buttons(markup).find(
    (b) => b.at > key.at && b.at < (next?.at ?? 0),
  );
  return between === undefined ? next : undefined;
}

function isRealKey({ style }: Node): boolean {
  return (
    Number(style?.width) >= minTouchTargetDp &&
    Number(style?.height) >= minTouchTargetDp
  );
}

function header(markup: string): string | undefined {
  const head = nodes(markup).find((n) => n.role === 'header');
  if (head === undefined) return undefined;
  const next = buttons(markup).find((b) => b.at > head.at);
  return markup
    .slice(markup.indexOf('>', head.at) + 1, next?.at)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function order(markup: string, ...needles: string[]): number[] {
  return needles.map((needle) => markup.indexOf(needle));
}

describe('AppBar', () => {
  it.each(MODES)('draws back as a chevron in a real 48dp key (%s)', (mode) => {
    const markup = render(<AppBar title="Tuner" onBack={noop} />, mode);
    const back = button(markup, 'Back');
    expect(isRealKey(back)).toBe(true);
    expect(iconIn(markup, back)).toMatchObject({
      label: 'back',
      px: iconSizes.bar,
    });
  });

  it('is one bar height tall', () => {
    const [bar] = nodes(render(<AppBar title="Settings" onBack={noop} />));
    expect(bar?.style?.minHeight).toBe(screenBar.height);
  });

  it('leaves the back key out when there is nowhere to go back to', () => {
    expect(buttons(render(<AppBar title="Kitbag" wordmark />))).toEqual([]);
  });

  it('keeps a title with no back key on the screen inset', () => {
    const [bar] = nodes(render(<AppBar title="Kitbag" wordmark />));
    expect(bar?.style?.paddingLeft).toBe(space.screenInset);
  });

  it('puts the title in the bar as its header', () => {
    const markup = render(<AppBar title="Calibrate latency" onBack={noop} />);
    expect(header(markup)).toBe('Calibrate latency');
  });

  it.each([
    [1, appBarTitleMinSize / textRoles.appBarTitle.size],
    [2, 0.5],
  ])('shrinks the title at font scale %d no further than %d', (scale, min) => {
    screen.fontScale = scale;
    const markup = render(<AppBar title="Metronome" onBack={noop} />);
    screen.fontScale = 1;
    const title = nodes(markup).find((n) => n.kind === 'text');
    expect(title).toMatchObject({ lines: 1, minScale: min });
  });

  it('never shrinks the title below its design size once text is grown', () => {
    const scale = 1.1;
    screen.fontScale = scale;
    const markup = render(<AppBar title="Metronome" onBack={noop} />);
    screen.fontScale = 1;
    const title = nodes(markup).find((n) => n.kind === 'text');
    expect((title?.minScale ?? 0) * scale).toBeGreaterThanOrEqual(
      1 - Number.EPSILON,
    );
  });

  it('shows a subtitle under the title', () => {
    const markup = render(
      <AppBar title="Blackbird" subtitle="The Beatles" onBack={noop} />,
    );
    expect(header(markup)).toBe('Blackbird The Beatles');
  });

  it('draws each action as a real 48dp key after the title', () => {
    const markup = render(
      <AppBar
        title="Songs"
        onBack={noop}
        actions={[
          { icon: 'setlist', label: 'Setlists', onPress: noop },
          { icon: 'more', label: 'Player menu', onPress: noop },
        ]}
      />,
    );
    expect(isRealKey(button(markup, 'Setlists'))).toBe(true);
    expect(isRealKey(button(markup, 'Player menu'))).toBe(true);
    const [back, title, action] = order(markup, 'Back', 'Songs', 'Setlists');
    expect(back).toBeLessThan(title ?? -1);
    expect(title).toBeLessThan(action ?? -1);
  });

  it('keeps caller nodes ahead of the actions', () => {
    const markup = render(
      <AppBar
        title="Kitbag"
        trailing={<b>Edit</b>}
        actions={[{ icon: 'settings', label: 'Settings', onPress: noop }]}
      />,
    );
    const [edit, settings] = order(markup, '<b>Edit</b>', 'Settings');
    expect(edit).toBeGreaterThan(-1);
    expect(edit).toBeLessThan(settings ?? -1);
  });

  it('lays custom content between back and the actions in place of a title', () => {
    const markup = render(
      <AppBar onBack={noop}>
        <b>Wedding set</b>
      </AppBar>,
    );
    const [back, content] = order(markup, 'Back', 'Wedding set');
    expect(back).toBeLessThan(content ?? -1);
    expect(header(markup)).toBeUndefined();
  });
});
