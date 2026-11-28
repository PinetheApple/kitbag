import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BEAT_SOURCE,
  TAP_LOCK_MISS,
  TAP_STEP,
  type TapAlong,
} from '@kitbag/core-state';

import { tapPadCopy, type TapPadInputs } from '../logic/tapPad.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return { View: host, Text: host, StyleSheet: { create: <T,>(s: T) => s } };
});

const seen = vi.hoisted(() => ({
  pads: [] as Props[],
  badges: [] as Props[],
  buttons: [] as Props[],
  leds: [] as Props[],
  icons: [] as Props[],
  scaled: false,
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    useTheme: () => ({ accentInk: 'accentInk' }),
    useTextScaled: () => seen.scaled,
    TapPad: (props: Props) => {
      seen.pads.push(props);
      return h('div', null, props.children, props.footer as ReactNode);
    },
    TapBadge: (props: Props) => {
      seen.badges.push(props);
      return null;
    },
    Button: (props: Props) => {
      seen.buttons.push(props);
      return null;
    },
    TapLeds: (props: Props) => {
      seen.leds.push(props);
      return null;
    },
    Icon: (props: Props) => {
      seen.icons.push(props);
      return null;
    },
  };
});

const { TapPad } = await import('./TapPad.tsx');

const SONG_BPM = 171;

const noTaps: TapAlong = {
  step: TAP_STEP.tapping,
  taps: [],
  offsets: [],
  result: undefined,
  halfOrDoubleBpm: undefined,
  tempoChoice: undefined,
  movedBeats: 0,
  cleared: undefined,
};

const song: TapPadInputs = {
  following: true,
  locked: false,
  playing: true,
  songBpm: SONG_BPM,
  tappedBpm: null,
  tapsLanded: 0,
  retap: false,
  offered: false,
  tapAlong: noTaps,
};

const fiveTaps: TapAlong = {
  ...noTaps,
  taps: [1, 2, 3, 4, 5],
  offsets: [-6, 4, 74, -8, 3].map((ms) => ({ ms, kept: ms !== 74 })),
  result: {
    locked: true,
    bpm: SONG_BPM,
    beatSource: BEAT_SOURCE.song,
    anchorMs: 0,
    beatMs: 1,
    gridMs: 1,
    spreadMs: 0,
    keptTaps: 4,
  },
};

const onAction = vi.fn();

function draw(inputs: TapPadInputs) {
  renderToStaticMarkup(
    createElement(TapPad, {
      copy: tapPadCopy(inputs),
      onTap: vi.fn(),
      onAction,
      onRelease: vi.fn(),
    }),
  );
}

beforeEach(() => {
  seen.pads.length = 0;
  seen.badges.length = 0;
  seen.buttons.length = 0;
  seen.leds.length = 0;
  seen.icons.length = 0;
  seen.scaled = false;
});

describe('TapPad while tapping (state b)', () => {
  it('lights the LEDs, draws a badge per tap and holds the solid border', () => {
    draw({ ...song, tapAlong: fiveTaps });
    expect(seen.pads[0]).toMatchObject({ active: true });
    expect(seen.leds[0]).toMatchObject({ landed: 4 });
    expect(seen.badges).toHaveLength(5);
    expect(seen.badges[2]).toMatchObject({
      label: '+74 ignored',
      ignored: true,
    });
    expect(seen.buttons).toHaveLength(0);
  });

  it('drops the badges at a large font scale and keeps the LEDs', () => {
    seen.scaled = true;
    draw({ ...song, tapAlong: fiveTaps });
    expect(seen.badges).toHaveLength(0);
    expect(seen.leds).toHaveLength(1);
  });
});

describe('TapPad choosing the 1 (state d)', () => {
  it('shows the tap icon and a skip button wired to the action', () => {
    draw({
      ...song,
      locked: true,
      tapAlong: { ...noTaps, step: TAP_STEP.chooseOne },
    });
    expect(seen.icons[0]).toMatchObject({ name: 'tapAlong' });
    expect(seen.leds).toHaveLength(0);
    expect(seen.buttons[0]).toMatchObject({
      label: 'The accent is right',
      icon: 'check',
      onPress: onAction,
    });
  });
});

describe('TapPad edges (state f)', () => {
  it('offers Start over when the taps are uneven', () => {
    draw({
      ...song,
      tapAlong: {
        ...fiveTaps,
        result: {
          locked: false,
          reason: TAP_LOCK_MISS.spread,
          spreadMs: null,
          tappedBpm: null,
        },
      },
    });
    expect(seen.pads[0]).toMatchObject({
      title: 'Taps are uneven',
      active: true,
    });
    expect(seen.buttons[0]).toMatchObject({
      label: 'Start over',
      icon: 'reset',
    });
  });

  it('keeps the dashed border and no badges while paused', () => {
    draw({ ...song, playing: false, tapAlong: fiveTaps });
    expect(seen.pads[0]).toMatchObject({
      title: 'Paused · 5 taps kept',
      active: false,
    });
    expect(seen.badges).toHaveLength(0);
  });
});
