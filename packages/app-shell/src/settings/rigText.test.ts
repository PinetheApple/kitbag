import type { OutputRoute } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  accentLabels,
  outputAccessibilityLabel,
  outputLine,
  rigChip,
  rigClickHint,
  routeRows,
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
    expect(rigChip('idle')).toEqual({
      label: 'Play · 100 BPM',
      icon: 'play',
      active: false,
    });
    expect(rigChip('starting').label).toBe('Stop · 100 BPM');
    expect(rigChip('playing')).toEqual({
      label: 'Stop · 100 BPM',
      icon: 'stop',
      active: true,
    });
  });

  it('says why the click cannot play', () => {
    expect(rigClickHint('idle', true)).toBe(
      'Stop the metronome to hear the rig click',
    );
    expect(rigClickHint('busy', false)).toBe(
      'The click could not start; try again',
    );
    expect(rigClickHint('failed', false)).toBe(
      'The click could not start; try again',
    );
    expect(rigClickHint('playing', false)).toBeNull();
  });
});

const GUESSED: OutputRoute = { ...HEADPHONES, certain: false };

describe('output row', () => {
  it('names the speaker and the jack by kind and other routes by name', () => {
    expect(outputLine(SPEAKER, undefined).name).toBe('Phone speaker');
    expect(outputLine(WIRED, undefined).name).toBe('Wired headphones · 3.5 mm');
    expect(outputLine(HEADPHONES, undefined).name).toBe('WH-1000XM4');
  });

  it('shows the offset stored for the live route, however it was set', () => {
    expect(outputLine(SPEAKER, 3)).toEqual({
      name: 'Phone speaker',
      status: ' · +3 ms',
    });
    expect(outputLine(SPEAKER, -12).status).toBe(' · \u221212 ms');
  });

  it('shows no offset for a route with nothing stored', () => {
    expect(outputLine(SPEAKER, undefined).status).toBe(' · 0 ms');
  });

  it('says a step is not saved while the route is guessed', () => {
    expect(outputLine(GUESSED, 3)).toEqual({
      name: 'WH-1000XM4',
      status: ' · not saved',
    });
  });

  it('says the output is unknown and a step is not saved when the route could not be read', () => {
    expect(outputLine(null, undefined)).toEqual({
      name: 'Unknown output',
      status: ' · not saved',
    });
  });
});

describe('output row for a screen reader', () => {
  it('reads the route, its detail and its status as a list, without separators', () => {
    expect(outputAccessibilityLabel(SPEAKER, undefined)).toBe(
      'Phone speaker, 0 ms',
    );
    expect(outputAccessibilityLabel(WIRED, 3)).toBe(
      'Wired headphones, 3.5 mm, +3 ms',
    );
    expect(outputAccessibilityLabel(null, undefined)).toBe(
      'Unknown output, not saved',
    );
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
