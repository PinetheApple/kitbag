// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entry } from '../logic/fixtures.test-helper.ts';

const NIGHT_BUS = 9;

const fake = vi.hoisted(() => ({
  stepSong: vi.fn(),
  carrySkip: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('@kitbag/core-state', () => ({
  ENTRY_KIND: { preset: 'preset', stem: 'stem' },
  isPresetEntry: (e: { kind: string }) => e.kind === 'preset',
  useLibrary: (select: (state: unknown) => unknown) =>
    select({ stepSong: fake.stepSong, carrySkip: fake.carrySkip }),
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ stop: fake.stop }),
}));

const { useStepSong } = await import('./useStepSong.ts');

const onOpenStemSet = vi.fn();
const onSkipped = vi.fn();

async function stepOnce() {
  let step: ((s: 1) => Promise<void>) | undefined;
  function Probe() {
    step = useStepSong({ onOpenStemSet, onSkipped });
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  await act(async () => {
    await step?.(1);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('stepping from the metronome app bar', () => {
  it('stops the click before it opens the stem player on a stem entry', async () => {
    fake.stepSong.mockResolvedValue({
      entry: { kind: 'stem', item: { id: 2 }, stemSetId: NIGHT_BUS },
      skipped: false,
    });
    await stepOnce();
    expect(fake.stop).toHaveBeenCalledOnce();
    expect(onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    const [stopped] = fake.stop.mock.invocationCallOrder;
    const [opened] = onOpenStemSet.mock.invocationCallOrder;
    expect(stopped).toBeLessThan(opened ?? 0);
  });

  it('carries a skip notice to the stem player it lands on', async () => {
    fake.stepSong.mockResolvedValue({
      entry: { kind: 'stem', item: { id: 2 }, stemSetId: NIGHT_BUS },
      skipped: true,
    });
    await stepOnce();
    expect(fake.carrySkip).toHaveBeenCalledWith(true);
    expect(onSkipped).not.toHaveBeenCalled();
  });

  it('says a skip on the metronome when it lands on a metronome entry, leaving the click alone', async () => {
    fake.stepSong.mockResolvedValue({ entry: entry(3, 'Ballad'), skipped: true });
    await stepOnce();
    expect(onSkipped).toHaveBeenCalledOnce();
    expect(fake.carrySkip).not.toHaveBeenCalled();
    expect(fake.stop).not.toHaveBeenCalled();
    expect(onOpenStemSet).not.toHaveBeenCalled();
  });
});
