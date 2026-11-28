import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Handler = (event?: unknown) => void;

interface PanConfig {
  readonly onBegin: Handler;
  readonly onActivate: Handler;
  readonly onUpdate: Handler;
  readonly onDeactivate: Handler;
  readonly onFinalize: Handler;
}

const seen = vi.hoisted(() => ({
  pressables: [] as Props[],
  pans: [] as PanConfig[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    Pressable: (props: Props) => {
      seen.pressables.push(props);
      return h(
        'button',
        { 'aria-label': props.accessibilityLabel },
        props.children,
      );
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: { View: (props: Props) => h('div', null, props.children) },
    useAnimatedReaction: () => undefined,
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({ value }),
  };
});

vi.mock('react-native-gesture-handler', async () => {
  const { createElement: h } = await import('react');
  return {
    usePanGesture: (config: PanConfig) => {
      seen.pans.push(config);
      return config;
    },
    GestureDetector: (props: Props) => h('section', null, props.children),
  };
});

vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => {
    run(...args);
  },
}));

vi.mock('./Icon.tsx', () => ({ Icon: () => null }));

const { DragListRow } = await import('./DragListRow.tsx');

const TITLE = 'Everlong';
const MORE_LABEL = `Actions for ${TITLE}`;
const DRAGGED_DP = 400;

const calls = {
  onPress: vi.fn(),
  onLongPress: vi.fn(),
  onActions: vi.fn(),
  onMove: vi.fn(),
};

function render(): string {
  seen.pressables.length = 0;
  seen.pans.length = 0;
  return renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <DragListRow
        title={TITLE}
        subtitle="158 · 4/4 · Click"
        accessibilityLabel={TITLE}
        reorder={{ index: 0, count: 3, onMove: calls.onMove }}
        onPress={calls.onPress}
        onLongPress={calls.onLongPress}
        onActions={calls.onActions}
      />
    </ThemeProvider>,
  );
}

function more(): Props {
  const found = seen.pressables.find(
    (p) => p.accessibilityLabel === MORE_LABEL,
  );
  if (found === undefined) throw new Error('no actions button');
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DragListRow actions button', () => {
  it('sits outside the drag handle, so a tap on it cannot begin a drag', () => {
    const markup = render();
    const handle = /<section>[\s\S]*?<\/section>/.exec(markup)?.[0] ?? '';
    expect(handle).not.toBe('');
    expect(handle).not.toContain(MORE_LABEL);
    expect(markup).toContain(`aria-label="${MORE_LABEL}"`);
  });

  it('opens the actions and nothing else when tapped', () => {
    render();
    (more().onPress as () => void)();
    expect(calls.onActions).toHaveBeenCalledOnce();
    expect(calls.onPress).not.toHaveBeenCalled();
    expect(calls.onLongPress).not.toHaveBeenCalled();
    expect(calls.onMove).not.toHaveBeenCalled();
  });

  it('never opens the actions from a drag on the handle', () => {
    render();
    const [pan] = seen.pans;
    if (pan === undefined) throw new Error('no drag');
    const event = { translationY: DRAGGED_DP, canceled: false };
    pan.onBegin(event);
    pan.onActivate(event);
    pan.onUpdate(event);
    pan.onDeactivate(event);
    pan.onFinalize(event);
    expect(calls.onActions).not.toHaveBeenCalled();
  });

  it('has no actions button without an actions handler', () => {
    seen.pressables.length = 0;
    renderToStaticMarkup(
      <ThemeProvider mode="dark">
        <DragListRow
          title={TITLE}
          accessibilityLabel={TITLE}
          reorder={{ index: 0, count: 1, onMove: calls.onMove }}
          onPress={calls.onPress}
        />
      </ThemeProvider>,
    );
    expect(
      seen.pressables.some((p) => p.accessibilityLabel === MORE_LABEL),
    ).toBe(false);
  });
});
