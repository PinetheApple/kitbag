import { STRETCH_END } from '@kitbag/core-db';
import { KB_RAMP_UNIT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { MINUTE, SECOND } from './session.test-helper.ts';
import { TEMPO_SETTLE_MS } from './stretch.ts';
import { harness, onStage } from './store.test-helper.ts';

const RAMP = {
  enabled: true,
  startBpm: 100,
  targetBpm: 124,
  stepBpm: 4,
  interval: 4,
  unit: KB_RAMP_UNIT.KB_RAMP_BARS,
  loop: false,
};

function ended(h: ReturnType<typeof harness>) {
  return h.practice.getState().endSession()?.log.stretches ?? [];
}

describe('practice session store log', () => {
  it('writes nothing until the session is saved, then writes once', async () => {
    const h = harness();
    const stage = await onStage(h);
    await stage.load(0);
    h.metronome.getState().start();
    h.advance(MINUTE);
    await stage.load(1);
    h.advance(MINUTE);
    h.metronome.getState().setBeats(3, 4);
    h.advance(MINUTE);
    h.metronome.getState().pause();
    h.advance(MINUTE);
    h.metronome.getState().start();
    h.advance(MINUTE);
    const recording = h.practice.getState().endSession();
    expect(h.insert).not.toHaveBeenCalled();
    await h.practice.getState().saveSession();
    expect(h.insert).toHaveBeenCalledTimes(1);
    expect(h.insert.mock.calls[0]?.[0]).toMatchObject({
      setlistName: 'Gig',
      log: recording?.log,
    });
    expect(recording?.log.stretches.map((stretch) => stretch.end)).toEqual([
      STRETCH_END.song,
      STRETCH_END.settings,
      STRETCH_END.pause,
      STRETCH_END.end,
    ]);
  });

  it('logs a song loaded while playing as one stretch per song', async () => {
    const h = harness();
    const stage = await onStage(h);
    await stage.load(0);
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().setTempo(90);
    h.advance(MINUTE);
    await stage.load(1);
    h.advance(MINUTE);
    expect(ended(h)).toMatchObject([
      {
        from: 0,
        to: 2 * MINUTE,
        end: STRETCH_END.song,
        song: { uuid: stage.uuids[0], title: 'First' },
        setlist: { name: 'Gig', position: 1 },
      },
      {
        from: 2 * MINUTE,
        to: 3 * MINUTE,
        end: STRETCH_END.end,
        song: { uuid: stage.uuids[1], title: 'Second' },
        setlist: { name: 'Gig', position: 2 },
        tempo: [],
      },
    ]);
  });

  it('coalesces a burst of tempo changes into one', () => {
    const h = harness();
    h.metronome.getState().setTempo(100);
    h.metronome.getState().start();
    h.advance(MINUTE);
    for (let bpm = 101; bpm <= 120; bpm++) {
      h.metronome.getState().setTempo(bpm);
      h.advance(TEMPO_SETTLE_MS / 10);
    }
    h.advance(MINUTE);
    expect(ended(h)).toMatchObject([{ tempo: [[MINUTE, 120]] }]);
  });

  it('logs a running ramp as its settings and the tempo it reached', () => {
    let engine = 100;
    const h = harness(() => engine);
    h.metronome.getState().setRamp(RAMP);
    h.metronome.getState().start();
    for (let second = 1; second <= 60; second++) {
      engine = 100 + Math.floor(second / 5);
      h.advance(SECOND);
    }
    h.metronome.getState().pause();
    expect(ended(h)).toMatchObject([
      {
        end: STRETCH_END.pause,
        settings: { rampEnabled: true, rampStartBpm: 100, rampEndBpm: 124 },
        tempo: [],
        endBpm: 112,
      },
    ]);
  });
});
