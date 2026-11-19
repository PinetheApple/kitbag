import { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stemPlayer } from '../stemPlayerRoles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import type { LoopHandles, ScrubMarks } from './ScrubRow.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Update = (event: { translationX: number }) => void;
type Done = (event: unknown, success: boolean) => void;

interface Pan {
  update: Update;
  end: Done;
  finalize: Done;
}

const seen = vi.hoisted(() => ({
  views: [] as Props[],
  pans: [] as { readonly testID: unknown; readonly pan: Pan }[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    View: (props: Props) => {
      seen.views.push(props);
      return h('div', { id: props.testID }, props.children);
    },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: {
      View: (props: Props) => {
        seen.views.push(props);
        return h('div', { id: props.testID }, props.children);
      },
    },
    useAnimatedReaction: () => undefined,
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({ value }),
  };
});

vi.mock('react-native-gesture-handler', async () => {
  const { createElement: h, Fragment } = await import('react');
  const unset = () => {
    throw new Error('callback not registered');
  };
  return {
    Gesture: {
      Pan: () => {
        const pan: Pan & Record<string, unknown> = {
          update: unset,
          end: unset,
          finalize: unset,
        };
        const chain = {
          pan,
          activeOffsetX: () => chain,
          onUpdate: (run: Update) => ((pan.update = run), chain),
          onEnd: (run: Done) => ((pan.end = run), chain),
          onFinalize: (run: Done) => ((pan.finalize = run), chain),
        };
        return chain;
      },
    },
    GestureDetector: (props: {
      gesture: { pan: Pan };
      children: ReactElement;
    }) => {
      const child = props.children.props as Props;
      seen.pans.push({ testID: child.testID, pan: props.gesture.pan });
      return h(Fragment, null, props.children);
    },
  };
});

vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => {
    run(...args);
  },
}));

vi.mock('./Slider.tsx', () => ({ Slider: () => null }));
vi.mock('./LiveText.tsx', () => ({ LiveText: () => null }));
vi.mock('./Icon.tsx', () => ({ Icon: () => null }));

const { ScrubRow } = await import('./ScrubRow.tsx');

const LOOP: ScrubMarks = { start: 0.2, end: 0.6 };
const ARMED: ScrubMarks = { start: 0.2, end: null };
const BAR_WIDTH = 200;
const LANE = { x: 0, y: 0, width: 320, height: stemPlayer.laneHeight };
const BAR = {
  x: 60,
  y: stemPlayer.laneTop,
  width: BAR_WIDTH,
  height: minTouchTargetDp,
};
const TAG = /<(\/?)div\b([^>]*)>/g;
const ID = /\bid="([^"]*)"/;
const MOVES = [20, 40];
const DROPPED = 0.4;
const PAST_END = 400;

const frame = {
  progress: { value: 0 },
  elapsed: { value: '' },
  second: { value: 0 },
  hold: vi.fn(),
};
const noop = vi.fn();
const handles = {
  onMoveLoopEdge: vi.fn<LoopHandles['onMoveLoopEdge']>(),
  onStepLoopEdge: vi.fn<LoopHandles['onStepLoopEdge']>(),
  spokenEdge: vi.fn<LoopHandles['spokenEdge']>(() => '1:10'),
} satisfies LoopHandles;

function layOut(testID: string, layout: object) {
  const view = seen.views.find((v) => v.testID === testID);
  (view?.onLayout as (event: unknown) => void)({ nativeEvent: { layout } });
}

function ancestorsOf(markup: string, id: string): string[] {
  const open: string[] = [];
  for (const [, closing, attributes = ''] of markup.matchAll(TAG)) {
    const tagId = ID.exec(attributes)?.[1];
    if (closing === '/') open.pop();
    else if (tagId === id) return open.filter(Boolean);
    else open.push(tagId ?? '');
  }
  throw new Error(`no ${id} in the markup`);
}

function render(marks: ScrubMarks, loopHandles?: LoopHandles): string {
  seen.views = [];
  seen.pans = [];
  const markup = renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <ScrubRow
        frame={frame as never}
        durationFrames={0}
        total=""
        spokenPosition={String}
        marks={marks}
        note={null}
        onScrub={noop}
        onCancel={noop}
        onSeek={noop}
        {...(loopHandles === undefined ? {} : { loopHandles })}
      />
    </ThemeProvider>,
  );
  layOut('scrub-lane', LANE);
  layOut('scrub-bar', BAR);
  return markup;
}

function panOf(edge: 'start' | 'end'): Pan {
  const found = seen.pans.find(
    (entry) => entry.testID === `loop-handle-${edge}`,
  );
  if (found === undefined) throw new Error(`no ${edge} handle`);
  return found.pan;
}

function adjustable(): Props[] {
  return seen.views.filter((view) => view.accessibilityActions !== undefined);
}

function act(edge: 'start' | 'end', actionName: string) {
  const view = adjustable().find((v) => v.testID === `loop-handle-${edge}`);
  (view?.onAccessibilityAction as (event: unknown) => void)({
    nativeEvent: { actionName },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ScrubRow loop handles', () => {
  it('commits the dropped fraction once, on release, for the dragged edge', () => {
    render(LOOP, handles);
    const pan = panOf('start');
    for (const translationX of MOVES) pan.update({ translationX });
    expect(handles.onMoveLoopEdge).not.toHaveBeenCalled();
    pan.end({}, true);
    pan.finalize({}, true);
    expect(handles.onMoveLoopEdge).toHaveBeenCalledOnce();
    const [edge, fraction] = handles.onMoveLoopEdge.mock.calls[0] ?? [];
    expect(edge).toBe('start');
    expect(fraction).toBeCloseTo(DROPPED);
  });

  it('stops a dragged edge at the other edge', () => {
    render(LOOP, handles);
    const pan = panOf('start');
    pan.update({ translationX: PAST_END });
    pan.end({}, true);
    expect(handles.onMoveLoopEdge).toHaveBeenCalledExactlyOnceWith(
      'start',
      LOOP.end,
    );
  });

  it('commits nothing when the drag is cancelled', () => {
    render(LOOP, handles);
    const pan = panOf('end');
    pan.update({ translationX: MOVES[0] ?? 0 });
    pan.end({}, false);
    pan.finalize({}, false);
    expect(handles.onMoveLoopEdge).not.toHaveBeenCalled();
  });

  it('steps each edge one step from a screen reader', () => {
    render(LOOP, handles);
    expect(adjustable()).toHaveLength(2);
    act('end', 'increment');
    act('start', 'decrement');
    expect(handles.onStepLoopEdge.mock.calls).toEqual([
      ['end', 1],
      ['start', -1],
    ]);
  });

  it('mounts the handles over the whole lane, not inside the bar', () => {
    const markup = render(LOOP, handles);
    expect(ancestorsOf(markup, 'loop-handles')).toEqual(['scrub-lane']);
    expect(ancestorsOf(markup, 'loop-handle-start')).toEqual([
      'scrub-lane',
      'loop-handles',
    ]);
    const layer = seen.views.find((v) => v.testID === 'loop-handles');
    expect(layer?.style).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });

  it('keeps the flags static without the prop', () => {
    render(LOOP);
    expect(seen.pans).toHaveLength(0);
    expect(adjustable()).toHaveLength(0);
  });

  it('keeps an armed start static', () => {
    render(ARMED, handles);
    expect(seen.pans).toHaveLength(0);
    expect(adjustable()).toHaveLength(0);
  });
});
