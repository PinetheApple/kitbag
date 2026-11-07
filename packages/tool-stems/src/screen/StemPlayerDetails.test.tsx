import {
  SNACKBAR_DURATION_MS,
  stemSections,
  stemSectionsText,
} from '@kitbag/core-design';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsHops } from '../testing/reanimatedDriver.ts';
import {
  at,
  INSTRUMENTAL,
  mountPlayer,
  PLAIN_LYRICS,
  SONG_DETAILS,
  type Player,
} from './playerHarness.test-helper.tsx';

const JUMP_VERSE = 'Jump to Verse, 0:04 to 0:08';
const LOOP_VERSE = 'Loop Verse, 0:04 to 0:08';
const STOP_VERSE = 'Stop looping Verse, 0:04 to 0:08';
const JUMP_OUTRO = 'Jump to Outro, 0:08 to 0:12';
const LOOP_OUTRO = 'Loop Outro, 0:08 to 0:12';

let player: Player | undefined;

async function open(change = SONG_DETAILS, tab: string | null = 'Lyrics') {
  player = await mountPlayer(change);
  if (tab !== null) await player.press(tab);
  return player;
}

afterEach(() => {
  player?.unmount();
  player = undefined;
  vi.useRealTimers();
});

describe('the Mix | Lyrics switch', () => {
  it('starts on Mix with the stem rows and no section cards', async () => {
    const p = await open(SONG_DETAILS, null);
    expect(p.labelled('Mix')).toHaveLength(1);
    expect(p.has('stem-1')).toBe(true);
    expect(p.labelled(JUMP_VERSE)).toHaveLength(0);
  });

  it('swaps the rows for cards and leaves playback and the mix alone', async () => {
    const p = await open(SONG_DETAILS, null);
    await p.press('Lyrics');
    const before = p.store.getState().stems;
    expect(p.has('stem-1')).toBe(false);
    expect(p.labelled(JUMP_VERSE)).toHaveLength(1);
    await p.press('Mix');
    expect(p.has('stem-1')).toBe(true);
    for (const command of [
      p.commands.mixerPlay,
      p.commands.mixerPause,
      p.commands.mixerStop,
      p.commands.mixerSeek,
      p.commands.mixerSetLoop,
      p.commands.mixerClearLoop,
      p.commands.mixerUnloadTrack,
    ])
      expect(command).not.toHaveBeenCalled();
    expect(p.store.getState().stems).toBe(before);
    expect(p.store.getState().status).toBe('ready');
  });

  it('is absent from a song with no sections and no lyrics', async () => {
    const p = await open({}, null);
    expect(p.labelled('Mix')).toHaveLength(0);
    expect(p.has('stem-1')).toBe(true);
  });
});

describe('a section card', () => {
  it('jumps on tap and sets no loop', async () => {
    const p = await open();
    await p.press(JUMP_VERSE);
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(at(4));
    expect(p.commands.mixerSetLoop).not.toHaveBeenCalled();
  });

  it('loops on hold', async () => {
    const p = await open();
    await p.hold(JUMP_VERSE);
    expect(p.commands.mixerSetLoop).toHaveBeenCalledWith(at(4), at(8));
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(at(4));
  });

  it('loops from its button, and the same button clears it', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    expect(p.commands.mixerSetLoop).toHaveBeenCalledWith(at(4), at(8));
    expect(p.labelled(LOOP_VERSE)).toHaveLength(0);
    await p.press(STOP_VERSE);
    expect(p.commands.mixerClearLoop).toHaveBeenCalledOnce();
    expect(p.labelled(LOOP_VERSE)).toHaveLength(1);
    expect(p.store.getState().loop.kind).toBe('off');
  });

  it('names the section in the loop note', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    expect(p.has('Verse · 0:04 – 0:08')).toBe(true);
  });

  it('seeks when held while it is already the loop, leaving no Undo', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    p.commands.mixerSetLoop.mockClear();
    await p.hold(JUMP_VERSE);
    expect(p.commands.mixerSetLoop).not.toHaveBeenCalled();
    expect(p.commands.mixerSeek).toHaveBeenLastCalledWith(at(4));
    expect(p.labelled('Undo')).toHaveLength(0);
  });
});

describe('Undo for a loop', () => {
  it('is hidden until a loop has been displaced', async () => {
    const p = await open();
    expect(p.store.getState().undoableLoop).toBeNull();
    expect(p.labelled('Undo')).toHaveLength(0);
    await p.press(LOOP_VERSE);
    expect(p.labelled('Undo')).toHaveLength(0);
  });

  it('restores a loop a hold replaced', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    await p.hold(JUMP_OUTRO);
    expect(p.has('Loop replaced')).toBe(true);
    p.commands.mixerSetLoop.mockClear();
    await p.press('Undo');
    expect(p.commands.mixerSetLoop).toHaveBeenCalledWith(at(4), at(8));
    expect(p.labelled('Undo')).toHaveLength(0);
  });

  it('restores a loop a tap outside it cleared', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    await p.press(JUMP_OUTRO);
    expect(p.has('Loop cleared')).toBe(true);
    expect(p.store.getState().loop.kind).toBe('off');
    await p.press('Undo');
    expect(p.store.getState().loop.kind).toBe('on');
  });

  it('stays away when a tap lands inside the loop', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    await p.press(JUMP_VERSE);
    expect(p.store.getState().loop.kind).toBe('on');
    expect(p.labelled('Undo')).toHaveLength(0);
  });

  it('goes away on its own, and returns for the next replacement', async () => {
    const p = await open();
    await p.press(LOOP_VERSE);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      p.store.setState({
        undoableLoop: { startSec: 1, endSec: 2 },
      });
      await Promise.resolve();
    });
    expect(p.labelled('Undo')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(p.labelled('Undo')).toHaveLength(0);
    expect(p.store.getState().undoableLoop).toBeNull();
    await act(async () => {
      p.store.setState({ undoableLoop: { startSec: 3, endSec: 4 } });
      await Promise.resolve();
    });
    expect(p.labelled('Undo')).toHaveLength(1);
  });

  it('shows an engine refusal with the app’s loop failure note', async () => {
    const p = await open();
    p.commands.mixerSetLoop.mockResolvedValueOnce(-1);
    await p.press(LOOP_OUTRO);
    expect(p.store.getState().loopFailure).toBe('engine');
    expect(p.has('Loop not set, try again')).toBe(true);
  });
});

describe('the Lyrics tab', () => {
  it('draws lines with inline section headings', async () => {
    const p = await open();
    expect(p.has('Intro · 0:00')).toBe(true);
    expect(p.has('Verse · 0:04')).toBe(true);
    expect(p.has('Two')).toBe(true);
    expect(p.labelled('Retime lyrics')).toHaveLength(1);
  });

  it('draws plain-only lyrics with the not-synced note and tap along', async () => {
    const p = await open({ ...SONG_DETAILS, lyrics: PLAIN_LYRICS });
    expect(p.has('Not synced · plain text from the bundle')).toBe(true);
    expect(p.has(PLAIN_LYRICS.plain)).toBe(true);
    expect(p.labelled('Tap along to sync')).toHaveLength(1);
    expect(p.labelled('Retime lyrics')).toHaveLength(0);
  });

  it('becomes Sections for an instrumental, with cards only', async () => {
    const p = await open({ ...SONG_DETAILS, lyrics: INSTRUMENTAL }, 'Sections');
    expect(p.labelled('Lyrics')).toHaveLength(0);
    expect(p.labelled(JUMP_VERSE)).toHaveLength(1);
    expect(p.has('Instrumental')).toBe(true);
    expect(p.labelled('Retime lyrics')).toHaveLength(0);
    expect(p.labelled('Tap along to sync')).toHaveLength(0);
  });

  it('does not call a song with no lyrics instrumental', async () => {
    const p = await open({ ...SONG_DETAILS, lyrics: null }, 'Sections');
    expect(p.labelled(JUMP_VERSE)).toHaveLength(1);
    expect(p.has('Instrumental')).toBe(false);
  });

  it('draws the lines without cards for a song with no sections', async () => {
    const p = await open({ ...SONG_DETAILS, sections: [] });
    expect(p.labelled(JUMP_VERSE)).toHaveLength(0);
    expect(p.has('Two')).toBe(true);
  });
});

describe('realtime values (SPEC §13.3)', () => {
  const currentSize = stemSectionsText.stageCurrent.size;
  const fontOf = (p: Player, text: string) =>
    (p.textNode(text)?.props.style as unknown[] | undefined)
      ?.flat()
      .reduce<number | undefined>(
        (size, part) =>
          (part as { fontSize?: number } | false)
            ? ((part as { fontSize?: number }).fontSize ?? size)
            : size,
        undefined,
      );

  it('commits nothing while the playhead stays inside a line', async () => {
    const p = await open();
    p.frames(3.6);
    const listener = vi.fn();
    const stop = p.store.subscribe(listener);
    p.commit.mockClear();
    jsHops.count = 0;
    for (let i = 0; i < 120; i++) p.frames(3.6 + i / 400);
    expect(p.commit).not.toHaveBeenCalled();
    expect(jsHops.count).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('commits at the boundary and lifts the new current line', async () => {
    const p = await open();
    p.frames(1.6);
    expect(fontOf(p, 'One')).toBe(currentSize);
    expect(fontOf(p, 'Two')).not.toBe(currentSize);
    p.commit.mockClear();
    p.frames(3.6);
    expect(p.commit).toHaveBeenCalled();
    expect(fontOf(p, 'Two')).toBe(currentSize);
    expect(fontOf(p, 'One')).not.toBe(currentSize);
  });

  it('never lights a line on a retimed plain song past its taps', async () => {
    const p = await open({
      ...SONG_DETAILS,
      lyrics: PLAIN_LYRICS,
      lyricsRetimed: [1],
    });
    p.frames(500);
    expect(fontOf(p, 'First line')).toBe(currentSize);
    expect(fontOf(p, 'Second line')).not.toBe(currentSize);
  });

  it('scrolls the current line into its reading place as it lays out', async () => {
    const p = await open();
    const list = p.renderer.root.findAll(
      (node) => node.props.testID === 'stage-lyrics',
    )[0];
    act(() => {
      (list?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { height: 300 } },
      });
    });
    p.frames(3.6);
    const row = p.renderer.root.findAll(
      (node) => node.props.testID === 'lyric-line-2',
    )[0];
    p.scrolls.mockClear();
    act(() => {
      (row?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { y: 400 } },
      });
    });
    expect(p.scrolls).toHaveBeenCalledWith({
      y: 400 - 300 * stemSections.followAtFraction,
      animated: true,
    });
  });

  it('grows the Retime chip hit box vertically only', async () => {
    const p = await open();
    const { paddingLeft, paddingRight, paddingTop, paddingBottom } = p.byLabel(
      'Retime lyrics',
    ).props.style as Record<string, number>;
    expect(paddingLeft).toBe(0);
    expect(paddingRight).toBe(0);
    expect(paddingTop).toBe(6);
    expect(paddingBottom).toBe(6);
  });

  it('draws no bar beside the current line', async () => {
    const p = await open();
    p.frames(3.6);
    const [row] = p.renderer.root.findAll(
      (n) => typeof n.type === 'string' && n.props.testID === 'lyric-line-2',
    );
    expect(
      row?.children.map((child) => (child as { type: string }).type),
    ).toEqual(['Text']);
  });

  it('marks only the current card as current', async () => {
    const p = await open();
    p.frames(5);
    const card = p.renderer.root.findAll(
      (node) => node.props.testID === 'section-card-1',
    )[0];
    const other = p.renderer.root.findAll(
      (node) => node.props.testID === 'section-card-2',
    )[0];
    expect(card?.props.accessibilityState).toEqual({ selected: true });
    expect(other?.props.accessibilityState).toEqual({ selected: false });
  });
});
