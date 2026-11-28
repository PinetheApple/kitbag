import {
  bodyLineHeight,
  playerWaveBars,
  QUEUE_TEXT,
  rowLineHeight,
  textRoles,
} from '@kitbag/core-design';
import {
  autoAdvanceDeps,
  configurePlayOrder,
  heardStore,
  libraryStore,
  playOrderStore,
  PREVIOUS_RESTARTS_AFTER_SECONDS,
  REPEAT,
  repeatStore,
  songLibraryStore,
  startAutoAdvance,
} from '@kitbag/core-state';
import { plain } from '@kitbag/core-state/src/playOrder/heard.test-helper.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { display } from '@kitbag/core-state/src/testing/reactNativeHosts.ts';
import {
  fakeQueue,
  metronomeEntryOnStage,
  queued,
  setQueued,
  stemRow,
  stems,
  withQueue,
} from './playQueue.test-helper.ts';
import {
  at,
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
  withTestId,
  type Player,
} from './playerHarness.test-helper.tsx';
import { REPEAT_LINE_ID, UP_NEXT, UP_NEXT_ROW_ID } from '@/listening/UpNextRow.tsx';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;
const PREVIOUS = 'Previous';
const PAST = PREVIOUS_RESTARTS_AFTER_SECONDS + 1;
const PRACTICE_SPEED = 0.75;
const WITHIN_SONG_PAST_WALL = PREVIOUS_RESTARTS_AFTER_SECONDS - 0.5;

configurePlayOrder({ queue: fakeQueue() });
startAutoAdvance(autoAdvanceDeps(playerWaveBars));

const libraryBefore = libraryStore.getState();

beforeEach(() => {
  setQueued([]);
  heardStore.setState({ heard: [] });
  songLibraryStore.setState({
    rows: [stemRow(NIGHT_BUS, 'Night Bus'), stemRow(TIN_ROOF, 'Tin Roof')],
  });
});

afterEach(() => {
  display.fontScale = 1;
  unmountTracked();
  libraryStore.setState(libraryBefore, true);
  repeatStore.setState({ mode: REPEAT.off, played: [], restart: null });
});

const previousOff = (p: Player) =>
  (p.byLabel(PREVIOUS).props.accessibilityState as { disabled: boolean })
    .disabled;

type Host = ReturnType<typeof withTestId>[number];

const labelledIn = (node: Host | undefined, label: string) =>
  node?.findAll(
    (host) =>
      typeof host.type === 'string' && host.props.accessibilityLabel === label,
  ) ?? [];

const upNextLabels = (p: Player) =>
  p.renderer.root.findAll(
    (node) => String(node.type) === 'Text' && node.props.children === UP_NEXT,
  );

const nextKeys = (p: Player) =>
  p.renderer.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      String(node.props.accessibilityLabel).startsWith('Next:'),
  );

const THREE_TEXT_LINES =
  textRoles.sectionLabel.size * bodyLineHeight +
  rowLineHeight.title +
  rowLineHeight.subtitle;

function rowMinHeight(p: Player): unknown {
  const [row] = withTestId(p, UP_NEXT_ROW_ID);
  const style: unknown = row?.props.style;
  return (
    Object.assign({}, ...[style].flat(Infinity)) as Record<string, unknown>
  ).minHeight;
}

async function queueNow(...ids: number[]) {
  setQueued(ids.map(stems));
  await playOrderStore.getState().refresh();
  await flush();
}

function playedTo(p: Player, songSeconds: number) {
  p.engine.position = at(songSeconds);
  p.frames(songSeconds);
}

describe('the Up next row', () => {
  it('keeps only Previous and Repeat, with no text, when nothing is up next', async () => {
    const p = await withQueue();
    expect(upNextLabels(p)).toEqual([]);
    expect(p.has(QUEUE_TEXT.nothingQueued)).toBe(false);
    expect(p.has('Playback stops when this song ends')).toBe(false);
    expect(p.labelled(PREVIOUS)).toHaveLength(1);
    expect(p.labelled(QUEUE_TEXT.repeatOff)).toHaveLength(1);
    expect(p.labelled('Open')).toEqual([]);
    expect(nextKeys(p)).toEqual([]);
  });

  it('shows its text once a song is queued, and drops it when the queue empties', async () => {
    const p = await withQueue();
    await queueNow(NIGHT_BUS);
    expect(upNextLabels(p)).toHaveLength(1);
    expect(p.has('Night Bus')).toBe(true);
    expect(nextKeys(p)).toHaveLength(1);
    await queueNow();
    expect(upNextLabels(p)).toEqual([]);
    expect(p.has('Night Bus')).toBe(false);
    expect(p.labelled(PREVIOUS)).toHaveLength(1);
    expect(p.labelled(QUEUE_TEXT.repeatOff)).toHaveLength(1);
  });

  it('holds the same height with and without its text, room for its three lines', async () => {
    const p = await withQueue();
    const bare = rowMinHeight(p);
    await queueNow(NIGHT_BUS);
    expect(upNextLabels(p)).toHaveLength(1);
    expect(rowMinHeight(p)).toBe(bare);
    expect(bare).toBe(THREE_TEXT_LINES);
  });

  it("shows a started setlist's next entry with nothing queued", async () => {
    metronomeEntryOnStage();
    const p = await withQueue();
    expect(upNextLabels(p)).toHaveLength(1);
    expect(p.has('Ballad')).toBe(true);
  });

  it('keeps only Previous and Repeat one under Repeat one with nothing up next', async () => {
    repeatStore.setState({ mode: REPEAT.one });
    const p = await withQueue();
    expect(upNextLabels(p)).toEqual([]);
    expect(p.has(QUEUE_TEXT.playsAgain)).toBe(false);
    expect(p.labelled(PREVIOUS)).toHaveLength(1);
    expect(p.labelled(QUEUE_TEXT.repeatOne)).toHaveLength(1);
  });

  it('says the song plays again under Repeat one while a song is queued', async () => {
    repeatStore.setState({ mode: REPEAT.one });
    const p = await withQueue(NIGHT_BUS);
    expect(upNextLabels(p)).toHaveLength(1);
    expect(p.has(QUEUE_TEXT.playsAgain)).toBe(true);
    expect(nextKeys(p)).toHaveLength(1);
  });

  it('names the first queued song and skips to it, dropping it from the queue', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    expect(p.has('Night Bus')).toBe(true);
    expect(p.has('Next in queue · 1 more after it')).toBe(true);
    await p.press('Next: Night Bus');
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(queued).toEqual([stems(TIN_ROOF)]);
  });
});

describe('the Up next row at the design size', () => {
  it("gives a metronome entry's repeat chip and Open their own line at the design size", async () => {
    metronomeEntryOnStage();
    const p = await withQueue();
    const [row] = withTestId(p, UP_NEXT_ROW_ID);
    const [line] = withTestId(p, REPEAT_LINE_ID);
    expect(labelledIn(line, QUEUE_TEXT.open)).toHaveLength(1);
    expect(labelledIn(line, QUEUE_TEXT.repeatOff)).toHaveLength(1);
    expect(labelledIn(row, QUEUE_TEXT.open)).toEqual([]);
    expect(labelledIn(row, QUEUE_TEXT.repeatOff)).toEqual([]);
    expect(labelledIn(row, PREVIOUS)).toHaveLength(1);
    expect(p.has('Gig · 1 of 1 · metronome')).toBe(true);
  });

  it('keeps a song entry on one line at the design size', async () => {
    const p = await withQueue(NIGHT_BUS);
    const [row] = withTestId(p, UP_NEXT_ROW_ID);
    expect(withTestId(p, REPEAT_LINE_ID)).toEqual([]);
    expect(labelledIn(row, QUEUE_TEXT.repeatOff)).toHaveLength(1);
    expect(labelledIn(row, 'Next: Night Bus')).toHaveLength(1);
  });
});

describe('the Up next row under font scale', () => {
  const repeatChips = (p: Player) => p.labelled(QUEUE_TEXT.repeatOff);
  const labelLines = (p: Player) =>
    p.renderer.root.find(
      (node) => String(node.type) === 'Text' && node.props.children === UP_NEXT,
    ).props.numberOfLines as unknown;

  it('keeps the repeat chip in the row beside the text at the design size', async () => {
    const p = await withQueue(NIGHT_BUS);
    expect(withTestId(p, REPEAT_LINE_ID)).toEqual([]);
    expect(repeatChips(p)).toHaveLength(1);
  });

  it('gives the repeat chip its own line at 2.0 and keeps the label on one', async () => {
    display.fontScale = 2;
    const p = await withQueue(NIGHT_BUS);
    const [line] = withTestId(p, REPEAT_LINE_ID);
    expect(repeatChips(p)).toHaveLength(1);
    expect(labelledIn(line, QUEUE_TEXT.repeatOff)).toHaveLength(1);
    expect(labelLines(p)).toBe(1);
  });

  it('keeps Previous and the repeat chip on one line at 2.0 with nothing up next', async () => {
    display.fontScale = 2;
    const p = await withQueue();
    expect(withTestId(p, REPEAT_LINE_ID)).toEqual([]);
    expect(repeatChips(p)).toHaveLength(1);
    expect(p.labelled(PREVIOUS)).toHaveLength(1);
  });

  it("moves a metronome entry's Open beside the repeat chip at 2.0", async () => {
    metronomeEntryOnStage();
    display.fontScale = 2;
    const p = await withQueue();
    const [line] = withTestId(p, REPEAT_LINE_ID);
    expect(p.labelled(QUEUE_TEXT.open)).toHaveLength(1);
    expect(labelledIn(line, QUEUE_TEXT.open)).toHaveLength(1);
  });
});

describe('Previous beside Up next', () => {
  it('is off for the first song heard while it is in its first seconds', async () => {
    const p = await mountTracked();
    expect(previousOff(p)).toBe(true);
  });

  it('turns on past the restart threshold and starts the song again', async () => {
    const p = await mountTracked();
    playedTo(p, PAST);
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(0);
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
  });

  it('judges the threshold in song time at practice speed, as the press does', async () => {
    const p = await mountTracked();
    await p.store.getState().setSpeed(PRACTICE_SPEED);
    playedTo(p, WITHIN_SONG_PAST_WALL);
    expect(previousOff(p)).toBe(true);
    playedTo(p, PAST);
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(0);
  });

  it('goes back to the song heard before, queueing the one it leaves first', async () => {
    heardStore.setState({
      heard: [plain(stems(NIGHT_BUS)), plain(stems(SET_ID))],
    });
    const p = await mountTracked();
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(queued).toEqual([stems(SET_ID)]);
    expect(heardStore.getState().heard).toEqual([plain(stems(NIGHT_BUS))]);
  });
});
