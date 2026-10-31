import { KB_VOLUME_BOUNDS, type OutputRoute } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  accentLabels,
  outputName,
  outputStatus,
  rigChip,
  rigClickHint,
  routeRows,
  VOLUME_SLIDER,
  volumeOfFraction,
  volumePercent,
} from './rigText.ts';

const SPEAKER: OutputRoute = {
  id: 'speaker',
  name: 'Speaker',
  kind: 'speaker',
  certain: true,
};
const WIRED: OutputRoute = {
  id: 'wired',
  name: 'Headset',
  kind: 'wired',
  certain: true,
};
const HEADPHONES: OutputRoute = {
  id: 'bt:xm4',
  name: 'WH-1000XM4',
  kind: 'bluetooth',
  certain: true,
};

describe('rig click chip', () => {
  it('offers to stop once the click is starting or playing', () => {
    expect(rigChip('idle')).toEqual({ label: 'Play · 100 BPM', icon: 'play' });
    expect(rigChip('starting').label).toBe('Stop · 100 BPM');
    expect(rigChip('playing')).toEqual({
      label: 'Stop · 100 BPM',
      icon: 'stop',
    });
  });

  it('says why the click cannot play', () => {
    expect(rigClickHint('idle', true)).toBe(
      'Stop the metronome to hear the rig click',
    );
    expect(rigClickHint('busy', false)).toBe(
      'Stop the metronome to hear the rig click',
    );
    expect(rigClickHint('failed', false)).toBe(
      'The click could not start; try again',
    );
    expect(rigClickHint('playing', false)).toBeNull();
  });
});

describe('click volume slider', () => {
  it('puts unity at the centre of the range', () => {
    expect(VOLUME_SLIDER.detent.at).toBe(0.5);
    expect(volumeOfFraction(VOLUME_SLIDER.detent.at)).toBe(1);
  });

  it('catches within 3% of the range either side of unity', () => {
    expect(VOLUME_SLIDER.detent.reach * KB_VOLUME_BOUNDS.max).toBeCloseTo(0.06);
  });

  it('turns red only past 150%', () => {
    expect(volumeOfFraction(VOLUME_SLIDER.warnAbove)).toBe(1.5);
  });

  it('reads out a whole percentage, red or not', () => {
    expect(volumePercent(1)).toBe('100%');
    expect(volumePercent(1.7)).toBe('170%');
    expect(volumePercent(0.004)).toBe('0%');
  });
});

describe('output row', () => {
  it('names the speaker and the jack by kind and other routes by name', () => {
    expect(outputName(SPEAKER)).toBe('Phone speaker');
    expect(outputName(WIRED)).toBe('Wired headphones · 3.5 mm');
    expect(outputName(HEADPHONES)).toBe('WH-1000XM4');
  });

  it('says whether the live route has a stored offset', () => {
    expect(outputStatus(true)).toBe('· calibrated');
    expect(outputStatus(false)).toBe('· not calibrated');
  });
});

describe('output sheet', () => {
  const stored = {
    [WIRED.id]: {
      route: WIRED.id,
      offsetMs: 2,
      name: 'Headset',
      kind: 'wired',
    },
    gone: { route: 'gone', offsetMs: 40, name: null, kind: 'hdmi' },
  };

  it('lists the live route first, then every stored route', () => {
    const rows = routeRows(HEADPHONES, stored, 12);
    expect(rows.map((r) => r.route.id)).toEqual([
      HEADPHONES.id,
      'gone',
      WIRED.id,
    ]);
  });

  it('marks the live route and shows its applied offset', () => {
    const [live] = routeRows(HEADPHONES, stored, 12);
    expect(live).toMatchObject({
      live: true,
      title: 'WH-1000XM4',
      meta: 'Bluetooth · in use now · never calibrated',
      offset: '+12 ms',
    });
  });

  it('shows a stored route not in use with its stored offset', () => {
    const wired = routeRows(HEADPHONES, stored, 12).find(
      (r) => r.route.id === WIRED.id,
    );
    expect(wired).toMatchObject({
      live: false,
      stored: true,
      meta: '3.5 mm',
      offset: '+2 ms',
    });
  });

  it('says never calibrated for a route without a stored offset', () => {
    const [speaker] = routeRows(SPEAKER, {}, 0);
    expect(speaker?.meta).toBe('In use now · never calibrated');
    expect(speaker?.offset).toBe('0 ms');
  });

  it('reads a stored kind it does not know as another output', () => {
    const gone = routeRows(null, stored, 0).find((r) => r.route.id === 'gone');
    expect(gone?.route.kind).toBe('other');
    expect(gone?.title).toBe('Audio output');
  });
});

describe('accent slot labels', () => {
  it('names the on-beat slot as the beat, then each off-beat', () => {
    expect(accentLabels(0b1010, 4)).toBe('Beat · accent · normal · accent');
  });
});
