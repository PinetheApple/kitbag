import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { SpeedGroup, type SpeedPresetOption } from './SpeedGroup.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const nodes = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  const record = (props: Props) => {
    nodes.push(props);
    return h('div', null, props.children);
  };
  return { ...actual, Pressable: record, View: record };
});

vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: () => null }));
vi.mock('./Sheet.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    SheetHint: ({ children }: Props) => h('p', null, children),
  };
});

const LABEL = 'Speed';
const HINT = 'Song 158 BPM, plays at 142 BPM';
const option = (value: number, selected: boolean): SpeedPresetOption => ({
  value,
  label: `${String(value * 100)}%`,
  accessibilityLabel: `Speed ${String(value * 100)}%`,
  selected,
});
const PRESETS = [option(0.5, false), option(0.9, true), option(1, false)];

function render(onStep = vi.fn(), onPick = vi.fn()) {
  nodes.length = 0;
  const markup = renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <SpeedGroup
        label={LABEL}
        value="90%"
        accented
        presets={PRESETS}
        hint={HINT}
        onStep={onStep}
        onPick={onPick}
      />
    </ThemeProvider>,
  );
  return { markup, onStep, onPick };
}

const labelled = (label: string) =>
  nodes.filter((node) => node.accessibilityLabel === label);

beforeEach(() => {
  nodes.length = 0;
});

describe('SpeedGroup', () => {
  it('shows the label, the speed and the hint', () => {
    const { markup } = render();
    expect(markup).toContain(LABEL);
    expect(markup).toContain(HINT);
    expect(labelled(LABEL)[0]?.accessibilityValue).toEqual({ text: '90%' });
  });

  it('marks only the selected preset', () => {
    render();
    expect(
      PRESETS.map(
        ({ accessibilityLabel }) =>
          labelled(accessibilityLabel)[0]?.accessibilityState,
      ),
    ).toEqual([{ selected: false }, { selected: true }, { selected: false }]);
  });

  it('picks the pressed preset by its value', () => {
    const { onPick } = render();
    (labelled('Speed 50%')[0]?.onPress as () => void)();
    expect(onPick).toHaveBeenCalledWith(0.5);
  });

  it('steps the speed from the stepper', () => {
    const { onStep } = render();
    (labelled(LABEL)[0]?.onAccessibilityAction as (event: unknown) => void)({
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onStep).toHaveBeenCalledWith(-1);
  });
});
