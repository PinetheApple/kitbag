// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { loggedSettingsOf } from '@kitbag/core-db';
import { ThemeProvider } from '@kitbag/core-design';
import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { CompiledToolsContext } from '@/tools/compiledToolsContext';

import { TimelineRows } from './TimelineRows.tsx';

const SECOND = 1000;

const settings = loggedSettingsOf({
  bpm: 96,
  beatsPerBar: 4,
  denominator: 4,
  subdivision: 1,
  accents: new Uint8Array([2, 1, 1, 1]),
  perAccentSounds: new Uint8Array([3, 3]),
  polyAccents: null,
  polyEnabled: false,
  polyBeats: 3,
  polyAgainst: 2,
  sound: 3,
  rampEnabled: false,
  rampStartBpm: null,
  rampEndBpm: null,
  rampStep: 1,
  rampLength: null,
  rampUnit: 0,
  rampLoop: false,
  barMuteEnabled: false,
  barMutePlayBars: null,
  barMuteMuteBars: null,
  countInBars: 2,
});

const stretch = {
  kind: 'stretch' as const,
  atMs: 0,
  playedMs: 60 * SECOND,
  startBpm: 96,
  tempoChanges: [],
  stretch: {
    from: 0,
    to: 60 * SECOND,
    end: 'song' as const,
    song: null,
    setlist: null,
    settings,
    countIn: { bars: 2, distinct: false, sound: 0 },
    tempo: [],
    endBpm: 96,
    avgBpm: 96,
  },
};

const host = {
  metronome: {
    countInLabel: (bars: number) => `${String(bars)} from the host`,
    useCustomSoundViews: () => [],
  },
};

const noSetlist = () => undefined;

function rendered(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <ThemeProvider mode="dark">
        <CompiledToolsContext.Provider value={{ host } as never}>
          <TimelineRows entries={[stretch] as never} setlistSize={noSetlist} />
        </CompiledToolsContext.Provider>
      </ThemeProvider>,
    );
  });
  if (tree === undefined) throw new Error('not rendered');
  return tree;
}

describe('the practice timeline', () => {
  it("badges the count-in with the host metronome's label", () => {
    expect(JSON.stringify(rendered().toJSON())).toContain(
      'Count-in 2 from the host',
    );
  });
});
