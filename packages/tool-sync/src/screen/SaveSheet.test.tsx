// react-test-renderer is deprecated, but it alone runs effects with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { KB_ACCENT } from '@kitbag/core-native';
import { SAVE_REFUSAL, type SaveOutcome } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SAVE_REFUSAL_TEXT, TEMPO_NOT_SAVED } from '../logic/saveForSong.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('host', null, props.children);
  return {
    View: host,
    Text: host,
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

const seen = vi.hoisted(() => ({
  sheets: [] as Props[],
  buttons: [] as Props[],
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h, Fragment } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    Sheet: (props: Props) => {
      seen.sheets.push(props);
      return h(Fragment, null, props.children, props.footer as ReactNode);
    },
    ButtonRow: (props: Props) => h(Fragment, null, props.children),
    Button: (props: Props) => {
      seen.buttons.push(props);
      return null;
    },
  };
});

const WOODBLOCK = 1;
const NUDGE_MS = 10;

const playAlong = vi.hoisted(() => ({
  lock: undefined as Record<string, unknown> | undefined,
  pattern: {},
  saveForTrack: vi.fn<() => Promise<SaveOutcome>>(),
}));

vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof playAlong) => T) =>
    selector(playAlong),
}));

const { SaveSheet } = await import('./SaveSheet.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const lock = {
  sessionId: 'spotify',
  track: { title: 'Blinding Lights', artist: 'The Weeknd', durationMs: null },
  phaseOffsetMs: NUDGE_MS,
};

const onDismiss = vi.fn();
let renderer: ReactTestRenderer | null = null;

function shown(visible = true): ReactTestRenderer {
  seen.sheets.length = 0;
  seen.buttons.length = 0;
  act(() => {
    renderer = create(
      createElement(SaveSheet, { visible, bottomInset: 0, onDismiss }),
    );
  });
  if (renderer === null) throw new Error('not rendered');
  return renderer;
}

const lastSheet = () => seen.sheets.at(-1);
const button = (label: string) =>
  seen.buttons.findLast((props) => props.label === label);
const words = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());

async function press(label: string): Promise<void> {
  await act(async () => {
    (button(label)?.onPress as () => void)();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  playAlong.lock = lock;
  playAlong.pattern = {
    beatsPerBar: 4,
    denominator: 4,
    subdivision: 1,
    accents: [KB_ACCENT.KB_ACCENT_ACCENTED, KB_ACCENT.KB_ACCENT_NORMAL],
    sounds: { normal: WOODBLOCK, accent: WOODBLOCK },
    volume: 1,
  };
  playAlong.saveForTrack.mockResolvedValue({ saved: true });
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe('SaveSheet', () => {
  it('is the drawn Save for this song sheet with the tempo hint', () => {
    shown();
    expect(lastSheet()).toMatchObject({
      visible: true,
      title: 'Save for this song',
      titleIcon: 'saveInto',
      hint: TEMPO_NOT_SAVED,
    });
  });

  it('lists the track and every saved field with its value', () => {
    const text = words(shown());
    for (const fact of [
      'Track',
      'Blinding Lights · The Weeknd',
      'Meter',
      '4/4',
      'Subdivision',
      'Quarters',
      'Accents',
      'Beat 1',
      'Sound',
      'Woodblock',
      'Phase nudge',
      '+10 ms',
    ])
      expect(text).toContain(JSON.stringify(fact));
  });

  it('stays closed while nothing is locked', () => {
    playAlong.lock = undefined;
    shown();
    expect(lastSheet()?.visible).toBe(false);
  });

  it('Cancel closes without saving', () => {
    shown();
    expect(button('Cancel')?.onPress).toBe(onDismiss);
    expect(playAlong.saveForTrack).not.toHaveBeenCalled();
  });

  it('Save writes the preset and closes once it is saved', async () => {
    shown();
    await press('Save');
    expect(playAlong.saveForTrack).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('takes one save at a time, with Save disabled while it runs', async () => {
    playAlong.saveForTrack.mockReturnValue(new Promise(() => undefined));
    shown();
    expect(button('Save')?.disabled).toBe(false);
    await press('Save');
    expect(button('Save')?.disabled).toBe(true);
    await press('Save');
    expect(playAlong.saveForTrack).toHaveBeenCalledTimes(1);
  });

  it('lets Save run again once a refused save returns', async () => {
    playAlong.saveForTrack.mockResolvedValue({
      saved: false,
      reason: SAVE_REFUSAL.writeFailed,
    });
    shown();
    await press('Save');
    expect(button('Save')?.disabled).toBe(false);
  });

  it('says why when the store refuses, and stays open', async () => {
    playAlong.saveForTrack.mockResolvedValue({
      saved: false,
      reason: SAVE_REFUSAL.noTrackIdentity,
    });
    const tree = shown();
    await press('Save');
    expect(onDismiss).not.toHaveBeenCalled();
    expect(words(tree)).toContain(
      SAVE_REFUSAL_TEXT[SAVE_REFUSAL.noTrackIdentity],
    );
  });

  it('drops an old refusal when the sheet opens again', async () => {
    playAlong.saveForTrack.mockResolvedValue({
      saved: false,
      reason: SAVE_REFUSAL.writeFailed,
    });
    const tree = shown();
    await press('Save');
    act(() => {
      (lastSheet()?.onShow as () => void)();
    });
    expect(words(tree)).not.toContain(
      SAVE_REFUSAL_TEXT[SAVE_REFUSAL.writeFailed],
    );
  });
});
