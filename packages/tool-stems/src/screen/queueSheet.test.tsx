// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  Button,
  DragListRow,
  iconSizes,
  playerWaveBars,
  queueSheet,
  screenBar,
  SheetHost,
  QUEUE_TEXT,
  repeatAllHint,
  ThemeProvider,
  useLeftSetlistNotice,
  useNotice,
} from '@kitbag/core-design';
import {
  configurePlayOrder,
  libraryStore,
  playOrderStore,
  REPEAT,
  repeatStore,
  songLibraryStore,
  songPlayerStore,
  stemPlayerStore,
  useLibrary,
  type QueuedSong,
} from '@kitbag/core-state';
import { act } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { display } from '../testing/reactNativeHosts.ts';
import { flush, textsOf } from './playerHarness.test-helper.tsx';
import {
  BALLAD_ITEM,
  BALLAD_PRESET,
  fakeQueue,
  GIG,
  HUM,
  hum,
  metronomeEntryOnStage,
  queued,
  setQueued,
  single,
  stemRow,
  stems,
} from './playQueue.test-helper.ts';
import {
  FOOTER_STACKED_ID,
  QueueSheet,
  type QueueSheetProps,
} from './QueueSheet.tsx';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;

configurePlayOrder({ queue: fakeQueue() });

let mounted: ReactTestRenderer | undefined;
const libraryBefore = libraryStore.getState();
const stemPlayerBefore = stemPlayerStore.getState();

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
  libraryStore.setState(libraryBefore, true);
  stemPlayerStore.setState(stemPlayerBefore, true);
  repeatStore.setState({ mode: REPEAT.off, allHintSeen: false });
});

type SheetUnderTestProps = Omit<QueueSheetProps, 'notice' | 'onLeftSetlist'>;

function SheetUnderTest(props: SheetUnderTestProps) {
  const notice = useNotice();
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  const leftSetlist = useLeftSetlistNotice(notice, rejoinSetlist);
  return <QueueSheet {...props} notice={notice} onLeftSetlist={leftSetlist} />;
}

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
        <SheetUnderTest
          {...routes}
          playsInPlace
          visible
          bottomInset={0}
          onDismiss={onDismiss}
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
  return {
    renderer,
    routes,
    onDismiss,
    press,
    has,
    texts: () => textsOf(renderer),
  };
}

const stemTakeOver = () =>
  vi.spyOn(stemPlayerStore.getState(), 'takeOver').mockResolvedValue('playing');

describe('the queue sheet footer under font scale', () => {
  afterEach(() => {
    display.fontScale = 1;
  });

  const footerTexts = (renderer: ReactTestRenderer) =>
    renderer.root
      .findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.props.testID === FOOTER_STACKED_ID,
      )
      .map((node) =>
        node
          .findAll((n) => String(n.type) === 'Text')
          .map((n) => n.props.children as unknown),
      );

  it('sets Done and Play queue side by side at the design size', async () => {
    const sheet = await openOnList(stems(NIGHT_BUS));
    expect(footerTexts(sheet.renderer)).toEqual([]);
  });

  it('stacks Play queue above Done at 2.0', async () => {
    display.fontScale = 2;
    const sheet = await openOnList(stems(NIGHT_BUS));
    expect(footerTexts(sheet.renderer)).toEqual([
      [QUEUE_TEXT.playQueue, QUEUE_TEXT.done],
    ]);
  });

  it('stacks Clear above Cancel in the confirm sheet at 2.0', async () => {
    display.fontScale = 2;
    const sheet = await openOnList(stems(NIGHT_BUS));
    await sheet.press(QUEUE_TEXT.clearQueue);
    expect(footerTexts(sheet.renderer)).toContainEqual(['Clear', 'Cancel']);
  });
});

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

describe('the queue sheet over a list, while a stem song plays', () => {
  beforeEach(() => {
    stemPlayerStore.setState({
      status: 'ready',
      setId: NIGHT_BUS,
      title: 'Night Bus',
      advancedTo: null,
    });
  });

  it('plays a tapped queued stem song in the same stem session', async () => {
    const playNow = vi
      .spyOn(stemPlayerStore.getState(), 'playNow')
      .mockResolvedValue('playing');
    const handOver = vi.spyOn(stemPlayerStore.getState(), 'handOver');
    const takeOver = stemTakeOver();
    const sheet = await openOnList(stems(TIN_ROOF));
    expect(sheet.has('Now playing')).toBe(true);
    await sheet.press('1. Tin Roof, queued. Plays it now');
    expect(playNow).toHaveBeenCalledExactlyOnceWith(TIN_ROOF);
    expect(handOver).not.toHaveBeenCalled();
    expect(takeOver).not.toHaveBeenCalled();
    expect(queued).toEqual([]);
  });

  it('stops the stem song before a metronome entry loads', async () => {
    const { loadSong } = metronomeEntryOnStage();
    const handToMetronome = vi
      .spyOn(stemPlayerStore.getState(), 'handToMetronome')
      .mockImplementation(() => undefined);
    const sheet = await openOnList();
    await sheet.press('Ballad, from Gig');
    expect(loadSong).toHaveBeenCalledWith(BALLAD_PRESET, BALLAD_ITEM, GIG);
    expect(handToMetronome).toHaveBeenCalledOnce();
    const [stopped] = handToMetronome.mock.invocationCallOrder;
    const [loaded] = loadSong.mock.invocationCallOrder;
    expect(stopped).toBeLessThan(loaded ?? 0);
  });
});

describe('the queue sheet against its value table', () => {
  const flat = (node: ReactTestInstance) =>
    StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

  it('pins its top under the app bar and keeps the footer out of the scroll', async () => {
    const sheet = await openOnList(stems(NIGHT_BUS));
    const pinned = sheet.renderer.root.findAll(
      (node) => flat(node).marginTop === screenBar.height,
    );
    expect(pinned.length).toBeGreaterThan(0);
    const [scroll] = sheet.renderer.root.findAllByType(ScrollView);
    const done = sheet.renderer.root.findAll(
      (node) => node.type === Button && node.props.label === 'Done',
    );
    expect(done).toHaveLength(1);
    expect(scroll?.findAll((node) => node === done[0])).toHaveLength(0);
  });

  it('draws the handle, the section keys and the swipe as the table says', async () => {
    const sheet = await openOnList(stems(NIGHT_BUS));
    const [row] = sheet.renderer.root.findAllByType(DragListRow);
    expect(row?.props.handle).toEqual({ size: 'queueHandle', color: 'text3' });
    expect(iconSizes.queueHandle).toBe(20);
    const clear = sheet.renderer.root.find(
      (node) => node.type === Button && node.props.label === 'Clear queue',
    );
    expect(iconSizes[clear.props.iconSize as keyof typeof iconSizes]).toBe(16);
    const trash = sheet.renderer.root.find(
      (node) =>
        typeof node.type !== 'string' &&
        node.props.name === 'delete' &&
        node.props.size !== undefined,
    );
    expect(iconSizes[trash.props.size as keyof typeof iconSizes]).toBe(20);
  });

  it('stacks the Now playing badges in a column 4 dp apart', async () => {
    stemPlayerStore.setState({
      status: 'ready',
      setId: NIGHT_BUS,
      title: 'Night Bus',
      advancedTo: null,
    });
    const sheet = await openOnList();
    const stack = sheet.renderer.root.findAll(
      (node) =>
        typeof node.type === 'string' && flat(node).gap === queueSheet.badgeGap,
    );
    expect(stack).toHaveLength(1);
    expect(queueSheet.badgeGap).toBe(4);
  });
});

describe('a metronome song in the setlist part of the queue', () => {
  it('carries a METRONOME badge, its own facts and the hint', async () => {
    metronomeEntryOnStage();
    const sheet = await openOnList();
    expect(sheet.has('METRONOME')).toBe(true);
    expect(sheet.has('Metronome song · 72 BPM · 4/4')).toBe(true);
    expect(sheet.has(QUEUE_TEXT.metronomeHint)).toBe(true);
  });

  it('shows no hint when no metronome song is left', async () => {
    const sheet = await openOnList(stems(NIGHT_BUS));
    expect(sheet.has(QUEUE_TEXT.metronomeHint)).toBe(false);
  });
});

function inSheetLayer(node: ReactTestInstance): boolean {
  for (let up: ReactTestInstance | null = node; up !== null; up = up.parent)
    if (typeof up.type === 'string' && up.props.pointerEvents === 'auto')
      return true;
  return false;
}

describe('leaving the setlist with the queue sheet open', () => {
  it('shows Undo in the sheet layer, over the open sheet', async () => {
    metronomeEntryOnStage();
    const leaveSetlist = vi.fn(() => {
      libraryStore.setState({ session: null });
      return Promise.resolve({
        setlistId: GIG,
        setlistName: 'Gig',
        restores: {
          session: { setlistId: GIG, skipped: [] },
          loaded: null,
          played: [],
          discarded: null,
        },
        leftAs: { session: null, loaded: null },
      });
    });
    libraryStore.setState({ leaveSetlist });
    const sheet = await openOnList();
    await sheet.press(QUEUE_TEXT.leaveSetlist);
    const undo = sheet.renderer.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityLabel === QUEUE_TEXT.undo,
    );
    expect(sheet.has('Left Gig')).toBe(true);
    expect(undo.some(inSheetLayer)).toBe(true);
  });
});

describe('the Repeat all hint in the queue sheet', () => {
  it('shows while Repeat all is on and the hint was never seen', async () => {
    repeatStore.setState({ mode: REPEAT.all, allHintSeen: false });
    const sheet = await openOnList(stems(NIGHT_BUS));
    expect(sheet.has(repeatAllHint(null))).toBe(true);
  });

  it('stays away once the seen flag is set', async () => {
    repeatStore.setState({ mode: REPEAT.all, allHintSeen: true });
    const sheet = await openOnList(stems(NIGHT_BUS));
    expect(sheet.has(repeatAllHint(null))).toBe(false);
  });
});
