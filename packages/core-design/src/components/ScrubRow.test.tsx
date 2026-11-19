import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';

type SecondReaction = (now: number, before: number | null) => void;

const worklet = vi.hoisted(() => ({
  reading: false,
  prepare: null as (() => number) | null,
  react: null as SecondReaction | null,
  before: null as number | null,
  committed: [] as number[],
}));

vi.mock('react-native-reanimated', () => ({
  useAnimatedReaction: (prepare: () => number, react: SecondReaction) => {
    worklet.prepare = prepare;
    worklet.react = react;
  },
}));

vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (_run: unknown, second: number) => {
    worklet.committed.push(second);
  },
}));

vi.mock('../useAccessibilityReadout.ts', () => ({
  useAccessibilityReadout: () => worklet.reading,
}));

vi.mock('./Slider.tsx', () => ({ Slider: () => null }));
vi.mock('./LiveText.tsx', () => ({ LiveText: () => null }));
vi.mock('./Icon.tsx', () => ({ Icon: () => null }));
vi.mock('./LoopMarks.tsx', () => ({
  LoopMarks: () => null,
  LoopHandleLayer: () => null,
  useLoopGeometry: () => ({}),
}));

const { ScrubRow } = await import('./ScrubRow.tsx');

const SHOWN_SECOND = 72;
const NEXT_SECOND = 73;
const REPEATS_OF_ONE_SECOND = 4;

const frame = {
  progress: { value: 0 },
  elapsed: { value: '' },
  second: { value: 0 },
  hold: vi.fn(),
};
const noop = vi.fn();

function runFrame() {
  const now = worklet.prepare?.() ?? null;
  if (now === null) throw new Error('ScrubRow registered no reaction');
  worklet.react?.(now, worklet.before);
  worklet.before = now;
}

function render(reading: boolean) {
  worklet.reading = reading;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <ScrubRow
        frame={frame as never}
        durationFrames={0}
        total=""
        spokenPosition={String}
        marks={null}
        note={null}
        onScrub={noop}
        onCancel={noop}
        onSeek={noop}
      />
    </ThemeProvider>,
  );
  runFrame();
}

function showSecond(second: number) {
  frame.second.value = second;
  runFrame();
}

beforeEach(() => {
  worklet.before = null;
  worklet.committed = [];
  frame.second.value = 0;
});

describe('ScrubRow spoken position', () => {
  it('reads the shown time once the service check resolves on mount', () => {
    frame.second.value = SHOWN_SECOND;
    render(false);
    render(true);
    expect(worklet.committed).toEqual([SHOWN_SECOND]);
  });

  it('reads the paused time when a service turns on, not 0:00', () => {
    render(false);
    showSecond(SHOWN_SECOND);
    showSecond(SHOWN_SECOND);
    render(true);
    expect(worklet.committed).toEqual([SHOWN_SECOND]);
  });

  it('commits once per whole second, not per frame', () => {
    render(true);
    for (let tick = 0; tick < REPEATS_OF_ONE_SECOND; tick += 1) {
      showSecond(SHOWN_SECOND);
    }
    showSecond(NEXT_SECOND);
    expect(worklet.committed).toEqual([0, SHOWN_SECOND, NEXT_SECOND]);
  });

  it('commits nothing while no service reads the value', () => {
    render(false);
    showSecond(SHOWN_SECOND);
    showSecond(NEXT_SECOND);
    expect(worklet.committed).toEqual([]);
  });
});
