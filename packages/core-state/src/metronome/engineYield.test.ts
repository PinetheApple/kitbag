import { describe, expect, it } from 'vitest';

import { metronomeCommands } from '../playAlong/store.test-helper.ts';
import { yieldableCommands } from './engineYield.ts';

const FIRST_BPM = 100;
const LAST_BPM = 140;
const BEAT = 1;
const OTHER_BEAT = 2;
const ACCENT = 2;
const SOUND = 3;

describe('yielding the engine to another slot', () => {
  it('passes commands straight through when not yielded', () => {
    const raw = metronomeCommands();
    yieldableCommands(raw).commands.setTempo(FIRST_BPM);
    expect(raw.setTempo).toHaveBeenCalledWith(FIRST_BPM);
  });

  it('holds commands and sends only the latest of each setting on return', () => {
    const raw = metronomeCommands();
    const engine = yieldableCommands(raw);
    const giveBack = engine.yieldEngine();
    engine.commands.setTempo(FIRST_BPM);
    engine.commands.setAccent(BEAT, ACCENT);
    engine.commands.setAccent(OTHER_BEAT, ACCENT);
    engine.commands.metronomeStop();
    engine.commands.metronomePause();
    engine.commands.setTempo(LAST_BPM);
    engine.commands.previewSound(SOUND, false);
    expect(engine.yielded()).toBe(true);
    expect(raw.setTempo).not.toHaveBeenCalled();
    giveBack();
    giveBack();
    expect(raw.setTempo.mock.calls).toEqual([[LAST_BPM]]);
    expect(raw.setAccent.mock.calls).toEqual([
      [BEAT, ACCENT],
      [OTHER_BEAT, ACCENT],
    ]);
    expect(raw.metronomeStop).not.toHaveBeenCalled();
    expect(raw.metronomePause).toHaveBeenCalledOnce();
    expect(raw.previewSound).not.toHaveBeenCalled();
    expect(engine.yielded()).toBe(false);
  });
});
