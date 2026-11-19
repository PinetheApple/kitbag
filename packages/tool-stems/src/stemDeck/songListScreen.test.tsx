import { size, TEXT_ICON_SCALE_MAX } from '@kitbag/core-design';
import {
  getNotificationPermissionStore,
  stemDeckStore,
} from '@kitbag/core-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { display } from '../testing/reactNativeHosts.ts';
import { SongListScreen } from './SongListScreen.tsx';
import {
  CATALOG,
  connected,
  live,
  mount,
  resetStemDeck,
  SONG_A,
  SONG_B,
} from './stemDeckHarness.test-helper.tsx';

const INSETS = { top: 0, bottom: 0 };
const UNITY_NOTE =
  'Songs arrive with every stem at its default level. A mix you made in StemDeck stays on the computer.';
const WAY_MAKER = 'Way Maker, Sinach · 8:01 · 6 stems';
const GRATITUDE = 'Gratitude, Brandon Lake · 5:52 · 3 stems';
const ECHO =
  'Echo (In Jesus Name) [LIVE], Charity Gayle · 5:11 · 6 stems, in library';

function songList(onImporting = vi.fn()) {
  return (
    <SongListScreen
      insets={INSETS}
      onBack={vi.fn()}
      onImporting={onImporting}
    />
  );
}

beforeEach(() => {
  resetStemDeck();
  connected();
});

afterEach(() => {
  display.fontScale = 1;
});

describe('importing a song already in the library', () => {
  const REPLACE_TITLE = 'Replace “Echo (In Jesus Name) [LIVE]”?';

  async function picked() {
    const importStarted = vi.fn(() => Promise.resolve());
    getNotificationPermissionStore().setState({ importStarted });
    const onImporting = vi.fn();
    const screen = await mount(songList(onImporting));
    await screen.press(ECHO);
    await screen.press(WAY_MAKER);
    await screen.press('Import 2 songs');
    return { screen, importStarted, onImporting, native: live().native };
  }

  it('asks first, before any notification ask or start', async () => {
    const { screen, importStarted, onImporting, native } = await picked();
    expect(screen.has(REPLACE_TITLE)).toBe(true);
    expect(native.startImport).not.toHaveBeenCalled();
    expect(importStarted).not.toHaveBeenCalled();
    expect(onImporting).not.toHaveBeenCalled();
  });

  it('replaces it, then asks about notifications and shows progress', async () => {
    const { screen, importStarted, onImporting, native } = await picked();
    await screen.press('Replace');
    expect(native.startImport.mock.calls[0]?.[1]).toHaveLength(2);
    expect(importStarted).toHaveBeenCalledOnce();
    expect(onImporting).toHaveBeenCalledOnce();
  });

  it('keeps the library copy and imports only the new song', async () => {
    const { screen, importStarted, onImporting, native } = await picked();
    await screen.press('Keep current');
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: SONG_A }),
    ]);
    expect(importStarted).toHaveBeenCalledOnce();
    expect(onImporting).toHaveBeenCalledOnce();
  });

  it('does nothing when the user decides not to import', async () => {
    const { screen, importStarted, onImporting, native } = await picked();
    await screen.press('Don’t import');
    expect(screen.has(REPLACE_TITLE)).toBe(false);
    expect(native.startImport).not.toHaveBeenCalled();
    expect(importStarted).not.toHaveBeenCalled();
    expect(onImporting).not.toHaveBeenCalled();
  });
});

describe('importing a song StemDeck separated again', () => {
  const LIBRARY_SONG = { id: 41, title: 'Gratitude' };
  const SEPARATED_AGAIN = 'Replace “Gratitude”?';

  async function picked() {
    connected({
      ...CATALOG,
      songs: CATALOG.songs.map((song) =>
        song.jobId === SONG_B ? { ...song, sameSong: LIBRARY_SONG } : song,
      ),
    });
    const onImporting = vi.fn();
    const screen = await mount(songList(onImporting));
    await screen.press(GRATITUDE);
    await screen.press('Import 1 song');
    return { screen, onImporting, native: live().native };
  }

  it('asks Cancel, Keep both or Replace before downloading', async () => {
    const { screen, onImporting, native } = await picked();
    expect(screen.has(SEPARATED_AGAIN)).toBe(true);
    expect(screen.labelled('Keep both')).toHaveLength(1);
    expect(screen.labelled('Keep current')).toHaveLength(0);
    expect(native.startImport).not.toHaveBeenCalled();
    expect(onImporting).not.toHaveBeenCalled();
  });

  it('keeps both by importing it as a new song', async () => {
    const { screen, onImporting, native } = await picked();
    await screen.press('Keep both');
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: SONG_B }),
    ]);
    expect(onImporting).toHaveBeenCalledOnce();
  });

  it('imports nothing on Cancel', async () => {
    const { screen, onImporting, native } = await picked();
    await screen.press('Cancel');
    expect(screen.has(SEPARATED_AGAIN)).toBe(false);
    expect(native.startImport).not.toHaveBeenCalled();
    expect(onImporting).not.toHaveBeenCalled();
  });
});

describe('the StemDeck song list', () => {
  it('counts every song StemDeck has in the subtitle', async () => {
    const screen = await mount(songList());
    expect(screen.has('192.168.1.50:8443 · 5 songs')).toBe(true);
    expect(
      screen.has(
        '2 more songs on StemDeck aren’t listed because their stems are missing on the computer.',
      ),
    ).toBe(true);
  });

  it('filters to a setlist with its chip', async () => {
    const screen = await mount(songList());
    await screen.press('Sunday worship · 1');
    expect(screen.labelled(GRATITUDE)).toHaveLength(1);
    expect(screen.labelled(WAY_MAKER)).toHaveLength(0);
    await screen.press('All songs');
    expect(screen.labelled(WAY_MAKER)).toHaveLength(1);
  });

  it('marks a song already in the library and leaves it out of Select all', async () => {
    const screen = await mount(songList());
    expect(screen.labelled(ECHO)).toHaveLength(1);
    expect(screen.has('IN LIBRARY')).toBe(true);
    await screen.press('Select all, 0 selected');
    expect(stemDeckStore.getState().selected).toEqual([SONG_A, SONG_B]);
    expect(screen.has('Import 2 songs')).toBe(true);
    await screen.press('Select all, 2 selected');
    expect(stemDeckStore.getState().selected).toEqual([]);
  });

  it('cannot import with nothing picked', async () => {
    const screen = await mount(songList());
    expect(screen.byLabel('Import songs').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('shows the mix note above Import until the first import, and asks about notifications', async () => {
    const importStarted = vi.fn(() => Promise.resolve());
    getNotificationPermissionStore().setState({ importStarted });
    const onImporting = vi.fn();
    const screen = await mount(songList(onImporting));
    expect(screen.texts().filter((t) => t === UNITY_NOTE)).toHaveLength(1);
    await screen.press(WAY_MAKER);
    await screen.press('Import 1 song');
    expect(importStarted).toHaveBeenCalledOnce();
    expect(onImporting).toHaveBeenCalledOnce();
    expect(screen.has(UNITY_NOTE)).toBe(false);
  });

  it('keeps titles and facts to one line and stops the checkbox growing at 1.5x', async () => {
    display.fontScale = 2;
    const screen = await mount(songList());
    const boxes = screen.hosts().filter((node) => {
      const style = [node.props.style].flat(Infinity) as ({
        width?: number;
      } | null)[];
      return style.some(
        (part) => part?.width === size.checkBox * TEXT_ICON_SCALE_MAX,
      );
    });
    expect(boxes.length).toBe(CATALOG.songs.length + 1);
    const titles = screen
      .hosts()
      .filter(
        (node) =>
          String(node.type) === 'Text' && node.props.numberOfLines === 1,
      );
    expect(titles.length).toBeGreaterThanOrEqual(CATALOG.songs.length * 2);
  });
});
