import { describe, expect, it } from 'vitest';

import {
  parsePracticeLog,
  PRACTICE_LOG_VERSION,
  STRETCH_END,
  type LoggedSettings,
  type LoggedStretch,
} from './practice-log';

const SETTINGS: LoggedSettings = {
  bpm: 96,
  beatsPerBar: 3,
  denominator: 4,
  subdivision: 2,
  accents: 'AgEB',
  perAccentSounds: 'AAE=',
  polyAccents: null,
  polyEnabled: false,
  polyBeats: 3,
  polyAgainst: 0,
  sound: 0,
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
  countInBars: 1,
};

const STRETCH: LoggedStretch = {
  from: 0,
  to: 60_000,
  end: STRETCH_END.end,
  song: { uuid: 'blackbird', title: 'Blackbird' },
  setlist: { uuid: 'wedding', name: 'Wedding set', position: 2 },
  settings: SETTINGS,
  countIn: { bars: 1, distinct: false, sound: 0 },
  tempo: [[30_000, 100]],
  endBpm: 100,
  avgBpm: 98,
};

const text = (stretch: object) =>
  JSON.stringify({ v: PRACTICE_LOG_VERSION, stretches: [stretch] });

describe('parsePracticeLog', () => {
  it('reads a well-formed log, stem songs and empty fields included', () => {
    const stem = { ...STRETCH, song: { stemSongKey: 'folder:s', title: 'S' } };
    const bare = { ...STRETCH, song: null, setlist: null, settings: null };
    for (const stretch of [STRETCH, stem, { ...bare, countIn: null }])
      expect(parsePracticeLog(text(stretch))).toEqual({
        v: PRACTICE_LOG_VERSION,
        stretches: [stretch],
      });
  });

  it.each([
    ['a song that is a number', { song: 5 }],
    ['a song without a title', { song: { uuid: 'x' } }],
    ['a setlist without a position', { setlist: { uuid: 'w', name: 'W' } }],
    ['settings with a text tempo', { settings: { ...SETTINGS, bpm: '96' } }],
    ['settings missing a field', { settings: { bpm: 96 } }],
    ['a count-in with text bars', { countIn: { bars: '1' } }],
    ['a tempo change that is not a pair', { tempo: [[1]] }],
    ['an end tempo that is not a number', { endBpm: null }],
  ])('reads a log with %s as none', (_, broken) => {
    expect(parsePracticeLog(text({ ...STRETCH, ...broken }))).toBeNull();
  });
});
