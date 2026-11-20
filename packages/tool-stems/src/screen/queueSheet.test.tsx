// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { playerWaveBars, SheetHost, ThemeProvider } from '@kitbag/core-design';
import {
  configurePlayOrder,
  playOrderStore,
  songLibraryStore,
  songPlayerStore,
  stemPlayerStore,
  type QueuedSong,
} from '@kitbag/core-state';
import { act } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flush, textsOf } from './playerHarness.test-helper.tsx';
import {
  fakeQueue,
  HUM,
  hum,
  queued,
  setQueued,
  single,
  stemRow,
  stems,
} from './playQueue.test-helper.ts';
import { QueueSheet } from './QueueSheet.tsx';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;

configurePlayOrder({ queue: fakeQueue() });

let mounted: ReactTestRenderer | undefined;

beforeEach(() => {
  songLibraryStore.setState({
    rows: [stemRow(NIGHT_BUS, 'Night Bus'), stemRow(TIN_ROOF, 'Tin Roof'), hum],
  });
});

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  mounted = undefined;
  vi.restoreAllMocks();
});

async function openOnList(...songs: QueuedSong[]) {
  setQueued(songs);
  await playOrderStore.getState().refresh();
  const routes = {
    onOpenStemSet: vi.fn(),
    onOpenSong: vi.fn(),
    onOpenMetronome: vi.fn(),
    onNotice: vi.fn(),
  };
  const onDismiss = vi.fn();
  const renderer = create(
    <ThemeProvider mode="dark">
      <SheetHost topInset={0}>
        <QueueSheet
          {...routes}
          playsInPlace
          visible
          bottomInset={0}
          onDismiss={onDismiss}
          onLeftSetlist={vi.fn()}
        />
      </SheetHost>
    </ThemeProvider>,
  );
  mounted = renderer;
  await flush();
  const byLabel = (label: string): ReactTestInstance =>
    renderer.root.find(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityLabel === label,
    );
  const press = async (label: string) => {
    await act(async () => {
      (byLabel(label).props.onPress as () => void)();
      await Promise.resolve();
    });
    await flush();
  };
  const has = (text: string) => textsOf(renderer).includes(text);
  return { routes, onDismiss, press, has, texts: () => textsOf(renderer) };
}

const stemTakeOver = () =>
  vi.spyOn(stemPlayerStore.getState(), 'takeOver').mockResolvedValue('playing');

describe('the queue sheet over a list, with nothing playing', () => {
  it('has no Now playing, and Play queue starts the first queued song here', async () => {
    const takeOver = stemTakeOver();
    const sheet = await openOnList(stems(NIGHT_BUS), stems(TIN_ROOF));
    expect(sheet.has('Now playing')).toBe(false);
    expect(sheet.has('· 2 up next')).toBe(true);
    await sheet.press('Play queue');
    expect(takeOver).toHaveBeenCalledExactlyOnceWith(
      NIGHT_BUS,
      playerWaveBars.stems,
    );
    expect(queued).toEqual([stems(TIN_ROOF)]);
    expect(sheet.routes.onOpenStemSet).not.toHaveBeenCalled();
    expect(sheet.onDismiss).toHaveBeenCalledOnce();
  });

  it('plays a tapped queued single song here, dropping the rows above it', async () => {
    const takeOver = vi
      .spyOn(songPlayerStore.getState(), 'takeOver')
      .mockResolvedValue('playing');
    const sheet = await openOnList(stems(NIGHT_BUS), single(HUM));
    await sheet.press('2. Hum, queued. Plays it now');
    expect(takeOver).toHaveBeenCalledExactlyOnceWith(HUM, playerWaveBars.song);
    expect(queued).toEqual([]);
    expect(sheet.routes.onOpenSong).not.toHaveBeenCalled();
  });

  it('shows the empty state with Done alone and no count', async () => {
    const sheet = await openOnList();
    expect(sheet.has('Nothing queued')).toBe(true);
    expect(sheet.has('Done')).toBe(true);
    expect(sheet.has('Play queue')).toBe(false);
    expect(sheet.texts().some((text) => text.endsWith('up next'))).toBe(false);
  });
});
