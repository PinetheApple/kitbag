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
