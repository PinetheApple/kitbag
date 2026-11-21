// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  meterCopy,
  screenBar,
  tempoSheetCopy,
  space,
  type LoopHandles,
} from '@kitbag/core-design';
import { ARRIVAL, arrivalStore, type QueuedSong } from '@kitbag/core-state';
import { act } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SONG_CLICK_TEXT } from '../logic/clickChipText.ts';
import { METER_FAILED } from '../logic/songMeterText.ts';
import {
  LOOP_KEY_TEXT,
  REANALYZE_LABEL,
  SONG_SPEED_TEXT,
} from '../logic/viewText.ts';
import {
  mount,
  onBack,
  screen,
  styleAround,
} from './SongPlayerScreen.mount.test-helper.ts';
import {
  commands,
  display,
  library,
  meter,
  mixer,
  OPEN_SONG,
  resetScreenState,
  SONG_SECONDS,
  tempo,
  transport,
} from './SongPlayerScreen.mocks.test-helper.ts';

vi.mock('react-native', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reactNativeMock(),
);

vi.mock('./EndedSetlistSnackbar.tsx', () => ({
  EndedSetlistSnackbar: () => null,
}));
vi.mock('./SongClickChips.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).clickChipsMock(),
);

vi.mock('react-native-reanimated', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reanimatedMock(),
);

vi.mock('@kitbag/core-design', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreDesignMock(
    original,
  ),
);

vi.mock('@kitbag/core-state', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreStateMock(
    original,
  ),
);

const ROW_TITLES: Readonly<Record<string, unknown>> = {
  MeterRow: meterCopy.title,
  TempoModeRow: tempoSheetCopy.row,
};
const CLOSED_SONG = { songId: null, title: '', artist: null, bpm: null };
const DROPPED_FRACTION = 0.25;

const UNSUPPORTED = {
  kind: 'unsupported',
  keptGrid: false,
  format: 'ogg',
  supported: ['WAV'],
};
const DAMAGED = { kind: 'damaged', keptGrid: false };
const MISSING = { kind: 'missingFile', keptGrid: false };

function failWith(failure: unknown) {
  library.rows = [{ kind: 'song', id: OPEN_SONG.songId }];
  library.failure = failure;
}

beforeEach(resetScreenState);

describe('the song player layout', () => {
  it('keeps the click toggle beside the text at the default size', () => {
    expect(styleAround(mount(), 'Chip').flexDirection).toBe('row');
  });

  it('stacks the click toggle under the text when scaled', () => {
    display.scaled = true;
    expect(styleAround(mount(), 'Chip').flexDirection).toBe('column');
  });

  it('sets the BPM badge in from the bar end', () => {
    expect(styleAround(mount(), 'Badge').marginRight).toBe(screenBar.chipEnd);
  });

  it('names an unsupported format when the song would not play', () => {
    display.status = 'failed';
    failWith(UNSUPPORTED);
    expect(mount().root.findByType('EmptyState' as never).props.reason).toBe(
      'OGG isn’t supported. Kitbag plays WAV.',
    );
  });

  it('says the song waits for its SD card when the card is out', () => {
    display.status = 'failed';
    failWith(null);
    library.files = 'unavailable';
    const box = mount().root.findByType('EmptyState' as never).props;
    expect([box.title, box.reason]).toEqual([
      'SD card not found',
      'This song is on the SD card, so it can’t play until the card is back.',
    ]);
  });

  it('keeps the general reason when the format is not to blame', () => {
    display.status = 'failed';
    failWith(DAMAGED);
    expect(
      mount().root.findByType('EmptyState' as never).props.reason,
    ).toContain('the audio engine did not start');
  });

  it.each(['failed', 'missing'])(
    'gives the %s box the screen inset',
    (status) => {
      display.status = status;
      expect(styleAround(mount(), 'EmptyState').paddingHorizontal).toBe(
        space.screenInset,
      );
    },
  );
});

describe('a stopped song', () => {
  it('shows no opening note once the song is stopped', () => {
    display.status = 'idle';
    const tree = mount();
    expect(
      tree.root.findAll((node) => String(node.type) === 'Text'),
    ).toHaveLength(0);
  });
});

describe('the app bar while the player leaves after Stop', () => {
  it('keeps the song it was showing once the session closes', () => {
    const tree = mount();
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(true));
    });
    const bar = tree.root.findByType('AppBar' as never);
    expect(bar.props).toMatchObject({
      title: OPEN_SONG.title,
      subtitle: OPEN_SONG.artist,
    });
    expect(bar.findAllByType('Badge' as never)).toHaveLength(1);
  });

  it('follows a rename while the song is open', () => {
    const tree = mount();
    display.song = { ...OPEN_SONG, title: 'Renamed' };
    act(() => {
      tree.update(screen(true));
    });
    expect(tree.root.findByType('AppBar' as never).props.title).toBe('Renamed');
  });
});

describe('a Stop from outside the player', () => {
  function stopOutside(tree: ReactTestRenderer, focused: boolean) {
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(focused));
    });
  }

  it('goes back when the shown song stops', () => {
    stopOutside(mount(), true);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not go back twice when the stop lands while leaving', () => {
    const tree = mount();
    act(() => {
      (tree.root.findByType('AppBar' as never).props.onBack as () => void)();
    });
    stopOutside(tree, true);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('stays put while the player is not on screen', () => {
    stopOutside(mount(false), false);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('stays put on a player that has not opened its song yet', () => {
    display.status = 'idle';
    mount();
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('holding the song', () => {
  it('reopens once after being displaced and balances its holds', () => {
    const tree = mount();
    expect(mixer.opens).toBe(1);
    act(() => {
      tree.update(screen(false));
    });
    mixer.session++;
    mixer.displaced++;
    act(() => {
      tree.update(screen(true));
    });
    expect(mixer.opens).toBe(2);
    act(() => {
      tree.unmount();
    });
    expect(mixer.opens).toBe(mixer.displaced + mixer.releases);
    expect(mixer.releases).toBe(1);
  });
});

describe('the player menu', () => {
  function menuButton(tree: ReactTestRenderer, label: string) {
    return tree.root.find(
      (node) => String(node.type) === 'MenuRow' && node.props.label === label,
    );
  }

  function menuLabels(tree: ReactTestRenderer) {
    return tree.root
      .findByType('Sheet' as never)
      .findAll((node) =>
        ['MenuRow', 'MeterRow', 'TempoModeRow'].includes(String(node.type)),
      )
      .map(
        (node): unknown =>
          ROW_TITLES[String(node.type)] ?? (node.props.label as unknown),
      );
  }

  function meterRow(tree: ReactTestRenderer) {
    return tree.root.findByType('MeterRow' as never);
  }

  function meterSheet(tree: ReactTestRenderer) {
    return tree.root.findByType('MeterSheet' as never);
  }

  function openMenu(): ReactTestRenderer {
    const tree = mount();
    const [more] = tree.root.findByType('AppBar' as never).props
      .actions as readonly { onPress: () => void }[];
    act(() => {
      more?.onPress();
    });
    return tree;
  }

  it('opens from the app bar', () => {
    const tree = mount();
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(openMenu().root.findAllByType('Sheet' as never)).toHaveLength(1);
  });

  it('resets the speed from the menu and closes it', () => {
    const tree = openMenu();
    const row = menuButton(tree, SONG_SPEED_TEXT.reset);
    expect(row.props.value).toBe('100%');
    act(() => {
      (row.props.onPress as () => void)();
    });
    expect(transport.resetSpeed).toHaveBeenCalledOnce();
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
  });

  it('leaves the player and stops the song', () => {
    const tree = openMenu();
    act(() => {
      (menuButton(tree, 'Stop').props.onPress as () => void)();
    });
    expect(onBack).toHaveBeenCalledOnce();
    expect(commands.close).toHaveBeenCalledOnce();
    expect(onBack.mock.invocationCallOrder[0]).toBeLessThan(
      commands.close.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('goes back only once when its Stop closes the song', () => {
    const tree = openMenu();
    act(() => {
      (menuButton(tree, 'Stop').props.onPress as () => void)();
    });
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(true));
    });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it.each([
    ['in an unsupported format', UNSUPPORTED],
    ['whose file is missing', MISSING],
  ])('offers no Re-analyse for a song %s', (_case, failure) => {
    failWith(failure);
    expect(menuLabels(openMenu())).toEqual([
      SONG_SPEED_TEXT.reset,
      'Meter',
      'Tempo',
      'Tempo correction',
      'Count-in',
      'Stop',
    ]);
  });

  it('lists Re-analyse, Meter, Tempo correction, Count-in and Stop', () => {
    expect(menuLabels(openMenu())).toEqual([
      SONG_SPEED_TEXT.reset,
      REANALYZE_LABEL,
      'Meter',
      'Tempo',
      'Tempo correction',
      'Count-in',
      'Stop',
    ]);
  });

  it("shows the song's count-in and opens the click sheet at it", () => {
    const tree = openMenu();
    const row = menuButton(tree, 'Count-in');
    expect(row.props).toMatchObject({ value: 'Off', disabled: false });
    act(() => {
      (row.props.onPress as () => void)();
    });
    const [sheet] = tree.root.findAllByType('Sheet' as never);
    expect(sheet?.props.title).toBe(SONG_CLICK_TEXT.title);
  });

  it('disables Count-in while the beat is found and says why', () => {
    display.analysis = { analysisStatus: 'analyzing', beats: [] };
    expect(menuButton(openMenu(), 'Count-in').props).toMatchObject({
      disabled: true,
      detail: 'Available once the beat is found',
      value: undefined,
    });
  });

  it('shows the detected meter, then the override as yours', () => {
    expect(meterRow(openMenu()).props).toMatchObject({
      value: 4,
      yours: false,
      disabled: false,
    });
    meter.override = { meterBeatsPerBar: 3, barOneSeconds: null };
    expect(meterRow(openMenu()).props).toMatchObject({ value: 3, yours: true });
  });

  it('opens the meter sheet from the Meter row and closes the menu', () => {
    const tree = openMenu();
    expect(meterSheet(tree).props.visible).toBe(false);
    act(() => {
      (meterRow(tree).props.onPress as () => void)();
    });
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(meterSheet(tree).props).toMatchObject({
      visible: true,
      options: [3, 4],
      detectedMeter: 4,
      detectedBarOneSeconds: 2.3,
      state: 'ready',
    });
  });

  it('says a meter that could not be saved, once the sheet closes', async () => {
    commands.save.mockResolvedValueOnce(false);
    const tree = openMenu();
    act(() => {
      (meterRow(tree).props.onPress as () => void)();
    });
    await act(async () => {
      (meterSheet(tree).props.onPickMeter as (meter: number) => void)(3);
      await Promise.resolve();
    });
    expect(meterSheet(tree).props.notice).toMatchObject({
      message: 'Could not save the meter.',
      actionLabel: 'Try again',
    });
    act(() => {
      (meterSheet(tree).props.onClose as () => void)();
    });
    const shown = tree.root.findAll(
      (node) =>
        String(node.type) === 'Snackbar' &&
        node.props.message === 'Could not save the meter.',
    );
    expect(shown).toHaveLength(1);
  });

  it.each(['failed', 'missing'])(
    'gives the failed reason when the song is %s',
    (status) => {
      display.status = status;
      expect(meterRow(openMenu()).props).toMatchObject({
        disabled: true,
        reason: METER_FAILED,
      });
    },
  );

  it.each([
    ['analysing', 'analyzing', 'Available once the beat is found'],
    ['failed', 'failed', METER_FAILED],
  ] as const)('disables Meter while %s and says why', (_case, status, why) => {
    display.analysis = { analysisStatus: status, beats: [] };
    expect(meterRow(openMenu()).props).toMatchObject({
      disabled: true,
      reason: why,
    });
  });

  it('re-analyses this song and closes the menu', () => {
    const tree = openMenu();
    act(() => {
      (menuButton(tree, REANALYZE_LABEL).props.onPress as () => void)();
    });
    expect(commands.reanalyze).toHaveBeenCalledExactlyOnceWith(1);
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(commands.close).not.toHaveBeenCalled();
  });
  function tempoRow(tree: ReactTestRenderer) {
    return menuButton(tree, 'Tempo correction');
  }

  it('shows the factor and the tempo it gives, and speaks them in words', () => {
    expect(tempoRow(openMenu()).props).toMatchObject({
      value: '×1 · 104 BPM',
      spokenValue: 'as detected, 104 BPM',
      icon: 'tempoCorrection',
      disabled: false,
    });
    tempo.correction = 'threeHalves';
    expect(tempoRow(openMenu()).props).toMatchObject({
      value: '×3/2 · 156 BPM',
      spokenValue: 'one and a half times, 156 BPM',
    });
  });

  it.each([
    ['analysing', 'analyzing', 'Available once the beat is found'],
    ['failed', 'failed', METER_FAILED],
  ] as const)(
    "disables Tempo correction while %s with Meter's reason",
    (_case, status, why) => {
      display.analysis = { analysisStatus: status, beats: [] };
      expect(tempoRow(openMenu()).props).toMatchObject({
        disabled: true,
        detail: why,
        value: undefined,
      });
    },
  );

  it('opens the five-option sheet from the row and closes the menu', () => {
    const tree = openMenu();
    act(() => {
      (tempoRow(tree).props.onPress as () => void)();
    });
    const sheet = tree.root.findByType('Sheet' as never);
    expect(sheet.props.title).toBe('Tempo correction');
    const picker = sheet.findByType('SegmentedControl' as never).props;
    expect(picker).toMatchObject({ selected: 'none', size: 'picker' });
    expect(
      (picker.options as readonly Record<string, string>[]).map((o) => [
        o.label,
        o.detail,
        o.accessibilityLabel,
      ]),
    ).toEqual([
      ['÷2', '52', 'Half, 52 BPM'],
      ['×2/3', '69', 'Two thirds, 69 BPM'],
      ['×1', '104', 'As detected, 104 BPM'],
      ['×3/2', '156', 'One and a half times, 156 BPM'],
      ['×2', '208', 'Double, 208 BPM'],
    ]);
    expect(
      sheet
        .findAllByType('SheetHint' as never)
        .map((n) => n.props.children as unknown),
    ).toEqual([
      'Detected: 104 BPM',
      'For a beat found too slow or too fast. The meter and bar 1 are kept.',
    ]);
  });
});

describe('a song with no beat grid', () => {
  const GRIDLESS = {
    analysing: { analysisStatus: 'analyzing', beats: [] },
    failed: { analysisStatus: 'failed', beats: [] },
    noGrid: { analysisStatus: 'done', beats: [] },
  } as const;

  function barBadge(tree: ReactTestRenderer) {
    return tree.root.findByType('AppBar' as never).findByType('Badge' as never)
      .props.label as unknown;
  }

  function texts(tree: ReactTestRenderer) {
    return tree.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => node.props.children as unknown);
  }

  it.each([
    ['analysing', 'ANALYZING'],
    ['failed', 'NO GRID'],
    ['noGrid', 'NO GRID'],
  ] as const)('badges the bar %s as %s', (state, label) => {
    display.analysis = GRIDLESS[state];
    expect(barBadge(mount())).toBe(label);
  });

  it('badges the bar with the BPM once there is a grid', () => {
    expect(barBadge(mount())).toBe('120 BPM');
  });

  it('keeps the grid badge while a re-analysis runs', () => {
    display.analysis = { analysisStatus: 'analyzing', beats: [0] };
    expect(barBadge(mount())).toBe('120 BPM');
  });

  it.each(['analysing', 'failed', 'noGrid'] as const)(
    'keeps the card but offers no click toggle while %s',
    (state) => {
      display.analysis = GRIDLESS[state];
      const tree = mount();
      expect(tree.root.findAllByType('Chip' as never)).toHaveLength(0);
      expect(texts(tree)).toContain(
        state === 'analysing' ? 'Finding the beat' : 'No beat grid',
      );
    },
  );

  it('re-analyses the song from a failed card', () => {
    display.analysis = GRIDLESS.failed;
    const tree = mount();
    const button = tree.root.find(
      (node) =>
        String(node.type) === 'Button' && node.props.label === REANALYZE_LABEL,
    );
    act(() => {
      (button.props.onPress as () => void)();
    });
    expect(commands.reanalyze).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('offers no Re-analyse on the card for an unsupported format', () => {
    display.analysis = GRIDLESS.failed;
    failWith(UNSUPPORTED);
    const tree = mount();
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Button' &&
          node.props.label === REANALYZE_LABEL,
      ),
    ).toHaveLength(0);
  });

  it('says a supported file may be damaged and offers Re-analyse', () => {
    display.analysis = GRIDLESS.failed;
    failWith(DAMAGED);
    const tree = mount();
    expect(texts(tree)).toContain('File may be damaged, so no click');
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Button' &&
          node.props.label === REANALYZE_LABEL,
      ),
    ).toHaveLength(1);
  });

  it('offers no Re-analyse while the beat is still being found', () => {
    display.analysis = GRIDLESS.analysing;
    const tree = mount();
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Button' &&
          node.props.label === REANALYZE_LABEL,
      ),
    ).toHaveLength(0);
  });
});

describe('the loop key on the transport', () => {
  it('labels the loop key A|B and marks the loop with it', () => {
    const dock = mount().root.findByType('PlayerTransport' as never);
    expect(dock.props.loopText).toBe(LOOP_KEY_TEXT);
    act(() => {
      (dock.props.onLoop as () => void)();
    });
    expect(transport.markLoop).toHaveBeenCalledOnce();
  });
});

describe('a re-analysis with an override set', () => {
  function detectedNotes(tree: ReactTestRenderer) {
    return tree.root.findAll(
      (node) =>
        String(node.type) === 'Snackbar' &&
        node.props.actionLabel === meterCopy.useDetected,
    );
  }

  function detectedNote(tree: ReactTestRenderer) {
    const [note] = detectedNotes(tree);
    if (note === undefined) throw new Error('no re-analysis notice');
    return note;
  }

  it('says the override is kept and offers the new result', async () => {
    meter.override = { meterBeatsPerBar: null, barOneSeconds: 105.3 };
    meter.notice = { meter: 3, barOneSeconds: 2.3 };
    const tree = mount();
    const notice = detectedNote(tree);
    expect(notice.props.message).toBe(
      'Re-analysed: 3/4, bar 1 at 0:02.3. Your bar 1 is kept.',
    );
    await act(async () => {
      (notice.props.onAction as () => void)();
      await Promise.resolve();
    });
    expect(commands.dismissMeterNotice).toHaveBeenCalledOnce();
    expect(commands.save).toHaveBeenCalledExactlyOnceWith(1, {
      meterBeatsPerBar: null,
      barOneSeconds: null,
    });
  });

  it('holds the notice while the Meter sheet is open', () => {
    meter.override = { meterBeatsPerBar: 3, barOneSeconds: null };
    meter.notice = { meter: 4, barOneSeconds: 2.3 };
    const tree = mount();
    const [more] = tree.root.findByType('AppBar' as never).props
      .actions as readonly { onPress: () => void }[];
    act(() => {
      more?.onPress();
    });
    act(() => {
      (tree.root.findByType('MeterRow' as never).props.onPress as () => void)();
    });
    expect(detectedNotes(tree)).toHaveLength(0);
    act(() => {
      (
        tree.root.findByType('MeterSheet' as never).props.onClose as () => void
      )();
    });
    expect(detectedNotes(tree)).toHaveLength(1);
  });
});

describe('the loop handles', () => {
  it('moves the dropped edge to its fraction of the song in seconds', () => {
    const row = mount().root.findByType('ScrubRow' as never);
    const handles = row.props.loopHandles as LoopHandles;
    act(() => {
      void handles.onMoveLoopEdge('end', DROPPED_FRACTION);
    });
    expect(transport.moveLoopEdge).toHaveBeenCalledExactlyOnceWith(
      'end',
      DROPPED_FRACTION * SONG_SECONDS,
    );
  });
});

describe('the song click chips', () => {
  it('open the Click for this song sheet over the player', () => {
    const tree = mount();
    const chips = tree.root.findByType('SongClickChips' as never);
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    act(() => {
      (chips.props.onOpen as (group: string) => void)('sound');
    });
    const titles = tree.root
      .findAllByType('Sheet' as never)
      .map((sheet) => sheet.props.title as string);
    expect(titles).toEqual(['Click for this song']);
  });
});

describe('a song the queue hands over to', () => {
  const HANDED_TO = 9;
  let serial = 0;
  const arriving = (song: QueuedSong) => {
    serial++;
    act(() => {
      arrivalStore.setState({
        arrival: { kind: ARRIVAL.arriving, song, serial },
      });
    });
  };
  const routes = () => ({
    onBack: vi.fn(),
    onOpenStemSet: vi.fn(),
    onOpenSong: vi.fn(),
  });

  it('puts the stem player in place of this one, without going back', () => {
    const own = routes();
    const tree = mount(true, own);
    arriving({ kind: 'stems', id: HANDED_TO });
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(true, own));
    });
    expect(own.onOpenStemSet).toHaveBeenCalledExactlyOnceWith(HANDED_TO);
    expect(own.onBack).not.toHaveBeenCalled();
    act(() => {
      tree.unmount();
    });
  });

  it('moves this player onto the next single song, without going back', () => {
    const own = routes();
    const tree = mount(true, own);
    arriving({ kind: 'song', id: HANDED_TO });
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(true, own));
    });
    expect(own.onOpenSong).toHaveBeenCalledExactlyOnceWith(HANDED_TO);
    expect(own.onOpenStemSet).not.toHaveBeenCalled();
    expect(own.onBack).not.toHaveBeenCalled();
    act(() => {
      tree.unmount();
    });
  });

  it('still goes back when the song it moved onto stops', () => {
    const own = routes();
    const tree = mount(true, own);
    arriving({ kind: 'song', id: HANDED_TO });
    act(() => {
      tree.update(screen(true, { ...own, songId: HANDED_TO }));
    });
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(true, { ...own, songId: HANDED_TO }));
    });
    expect(own.onBack).toHaveBeenCalledOnce();
    act(() => {
      tree.unmount();
    });
  });

  it('follows nothing while another screen covers it', () => {
    const own = routes();
    const tree = mount(false, own);
    arriving({ kind: 'stems', id: HANDED_TO });
    expect(own.onOpenStemSet).not.toHaveBeenCalled();
    act(() => {
      tree.unmount();
    });
  });
});
