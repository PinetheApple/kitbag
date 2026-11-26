import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const presses = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: (props: Props) => h('span', null, props.children),
    Pressable: (props: Props) => {
      presses.push(props);
      return h('button', null, props.children);
    },
    StyleSheet: { create: <T,>(s: T) => s },
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
  Icon: () => null,
}));

const { Stepper } = await import('./Stepper.tsx');
const { NUDGE_KEYS } = await import('./phaseKeys.ts');

function drawn(props: Partial<Parameters<typeof Stepper>[0]> = {}) {
  presses.length = 0;
  const onStep = vi.fn();
  const markup = renderToStaticMarkup(
    createElement(Stepper, {
      value: '+10 ms',
      keys: NUDGE_KEYS,
      onStep,
      ...props,
    }),
  );
  return { markup, onStep };
}

const pressOn = (label: string) => {
  const key = presses.find((p) => p.accessibilityLabel === label);
  (key?.onPress as () => void)();
};

beforeEach(() => {
  presses.length = 0;
});

describe('Stepper', () => {
  it('steps back with the earlier key and forward with the later key', () => {
    const { onStep } = drawn();
    pressOn(NUDGE_KEYS.earlierLabel);
    pressOn(NUDGE_KEYS.laterLabel);
    expect(onStep.mock.calls).toEqual([[-1], [1]]);
  });

  it('shows its value, pressable only when it opens something', () => {
    expect(drawn().markup).toContain('+10 ms');
    expect(presses).toHaveLength(2);
    const onValuePress = vi.fn();
    drawn({ onValuePress, valueLabel: 'Phase +10 ms' });
    pressOn('Phase +10 ms');
    expect(onValuePress).toHaveBeenCalledOnce();
  });

  it('disables both keys when disabled', () => {
    drawn({ disabled: true });
    expect(presses.map((p) => p.disabled)).toEqual([true, true]);
  });
});
