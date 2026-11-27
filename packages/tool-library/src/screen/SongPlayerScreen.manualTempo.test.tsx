// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SET_TEMPO_TEXT } from '../logic/manualTempoText.ts';
import { METER_FAILED } from '../logic/songMeterText.ts';
import { REANALYZE_LABEL } from '../logic/viewText.ts';
import {
  mount,
  pressBarAction,
  screen,
} from './SongPlayerScreen.mount.test-helper.ts';
import {
  commands,
  display,
  manual,
  resetScreenState,
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
vi.mock('../../../core-design/src/components/Button.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['Button']),
);
vi.mock('../../../core-design/src/components/Chip.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['Chip']),
);
vi.mock('../../../core-design/src/components/Snackbar.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['Snackbar']),
);
vi.mock('../../../core-design/src/components/BeatStrip.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['BeatStrip']),
);
vi.mock('../../../core-design/src/components/LiveText.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['LiveText']),
);
vi.mock('../../../core-design/src/components/PresetButton.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['PresetButton']),
);
vi.mock('../../../core-design/src/components/SegmentedControl.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['SegmentedControl']),
);
vi.mock('../../../core-design/src/components/Stepper.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['Stepper']),
);
vi.mock('../../../core-design/src/components/NumpadKeypad.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['NumpadKeypad']),
);
vi.mock('../../../core-design/src/components/NumpadReadout.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['NumpadReadout']),
);
vi.mock('../../../core-design/src/components/TapPad.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['TapLeds', 'TapPad']),
);
vi.mock('../../../core-design/src/components/Icon.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designPartMock(['Icon']),
);
vi.mock('../../../core-design/src/components/Sheet.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designSheetMock(),
);
vi.mock('../../../core-design/src/ThemeProvider.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).designThemeMock(),
);
vi.mock('../../../core-design/src/setTempo/SetTempoTransport.tsx', () => ({
  SetTempoTransport: () => null,
}));
vi.mock('react-native-reanimated', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reanimatedMock(),
);
vi.mock('@kitbag/core-design', async (original) =>
  (
    await import('./SongPlayerScreen.mocks.test-helper.ts')
  ).coreDesignWithSetTempoMock(original),
);
vi.mock('@kitbag/core-state', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreStateMock(
    original,
  ),
);

const MANUAL = { bpm: 128, anchor: 2.3, beatsPerBar: 4 };
const NO_GRID = { analysisStatus: 'failed', beats: [] };
const TAP_GAP_MS = 500;
const NEXT_SONG = 2;

beforeEach(resetScreenState);

type Press = () => void;

const byType = (tree: ReactTestRenderer, type: string) =>
  tree.root.findAllByType(type as never);

function withProp(
  tree: ReactTestRenderer,
  type: string,
  prop: string,
  value: unknown,
): ReactTestInstance {
  const found = byType(tree, type).find((node) => node.props[prop] === value);
  if (found === undefined) throw new Error(`no ${type} with ${prop}`);
  return found;
}

function press(node: ReactTestInstance, handler = 'onPress') {
  act(() => {
    (node.props[handler] as Press)();
  });
}

const menuRow = (tree: ReactTestRenderer, label: string) =>
  byType(tree, 'MenuRow').find((row) => row.props.label === label);

function only(node: ReactTestInstance | undefined): ReactTestInstance {
  if (node === undefined) throw new Error('not rendered');
  return node;
}

const first = (tree: ReactTestRenderer, type: string) =>
  only(byType(tree, type)[0]);

function openMenu(): ReactTestRenderer {
  const tree = mount();
  pressBarAction(tree, 'More');
  return tree;
}

function typeTempo(tree: ReactTestRenderer, digits: readonly number[]) {
  const pad = byType(tree, 'NumpadKeypad')[0];
  if (pad === undefined) throw new Error('no numpad');
  act(() => {
    for (const digit of digits)
      (pad.props.onDigit as (d: number) => void)(digit);
  });
  press(pad, 'onConfirm');
}

function confirmReanalyse(tree: ReactTestRenderer) {
  press(only(menuRow(tree, REANALYZE_LABEL)));
  press(first(tree, 'ConfirmDialog'), 'onConfirm');
}

function runAnalysis(tree: ReactTestRenderer, statuses: readonly string[]) {
  for (const analysisStatus of statuses) {
    display.analysis = { analysisStatus, beats: [0] };
    act(() => {
      tree.update(screen(true));
    });
  }
}

async function save(tree: ReactTestRenderer) {
  const button = withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.save);
  await act(async () => {
    (button.props.onPress as Press)();
    await Promise.resolve();
  });
}

describe('a song with no beat grid', () => {
  beforeEach(() => {
    display.analysis = NO_GRID;
  });

  it('offers Set tempo where the click chips were', () => {
    const tree = mount();
    expect(byType(tree, 'SongClickChips')).toHaveLength(0);
    expect(
      withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title).props,
    ).toMatchObject({
      variant: 'accentTonal',
      icon: 'metronome',
    });
  });

  it('lists Set tempo in the Player sheet and says Meter needs it first', () => {
    const tree = openMenu();
    expect(menuRow(tree, SET_TEMPO_TEXT.title)?.props.detail).toBe(
      SET_TEMPO_TEXT.menuDetail,
    );
    expect(byType(tree, 'MeterRow')[0]?.props.reason).toBe(METER_FAILED);
    expect(METER_FAILED).toBe('Needs a beat grid. Set tempo first.');
  });

  it('saves a typed tempo with bar 1 at the playhead and offers Undo, leaving the click as the Preview chip shows it', async () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    expect(
      withProp(tree, 'Sheet', 'title', SET_TEMPO_TEXT.title).props.titleDetail,
    ).toBe(SET_TEMPO_TEXT.stepOne);
    typeTempo(tree, [1, 2, 8]);
    manual.playheadSeconds = 2.3;
    press(withProp(tree, 'Button', 'label', 'Bar 1 here'));
    await save(tree);
    expect(manual.setManualTempo).toHaveBeenCalledWith(MANUAL);
    expect(transport.toggleClick).not.toHaveBeenCalled();
    const undo = withProp(tree, 'Snackbar', 'actionLabel', 'Undo');
    expect(undo.props.message).toBe('Tempo set: 128 BPM, bar 1 at 0:02.3.');
    press(undo, 'onAction');
    expect(manual.undoTempo).toHaveBeenCalledOnce();
  });

  it('keeps the sheet open and says so when the tempo is not stored', async () => {
    manual.setManualTempo.mockResolvedValueOnce(false);
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [9, 0]);
    await save(tree);
    expect(
      withProp(tree, 'Snackbar', 'message', SET_TEMPO_TEXT.saveFailed),
    ).toBeDefined();
    expect(byType(tree, 'BeatStrip')).toHaveLength(1);
  });

  it('previews the draft grid while bar 1 is marked, and drops it on Back', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    expect(manual.previewTempo).not.toHaveBeenCalledWith(
      expect.objectContaining({ bpm: 128 }),
    );
    manual.playheadSeconds = 2.3;
    typeTempo(tree, [1, 2, 8]);
    expect(manual.previewTempo).toHaveBeenLastCalledWith(MANUAL);
    press(withProp(tree, 'PresetButton', 'label', '+10 ms'));
    expect(manual.previewTempo).toHaveBeenLastCalledWith({
      ...MANUAL,
      anchor: 2.31,
    });
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.back));
    expect(manual.previewTempo).toHaveBeenLastCalledWith(null);
    expect(manual.setManualTempo).not.toHaveBeenCalled();
  });

  it('plays the click against the song from the Preview click chip', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    press(withProp(tree, 'Chip', 'label', SET_TEMPO_TEXT.previewClick));
    expect(transport.toggleClick).toHaveBeenCalledOnce();
  });

  it('drops the preview when the sheet is closed', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    press(withProp(tree, 'Sheet', 'title', SET_TEMPO_TEXT.title), 'onDismiss');
    expect(manual.previewTempo).toHaveBeenLastCalledWith(null);
  });

  it('drops the preview when the player goes away', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    act(() => {
      tree.unmount();
    });
    expect(manual.previewTempo).toHaveBeenLastCalledWith(null);
  });

  it('closes the sheet and forgets the Undo when the queue moves to the next song', async () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    await save(tree);
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    act(() => {
      tree.update(screen(true, { songId: NEXT_SONG }));
    });
    expect(byType(tree, 'Sheet')).toHaveLength(0);
    expect(
      byType(tree, 'Snackbar').filter(
        (bar) => bar.props.actionLabel === 'Undo',
      ),
    ).toHaveLength(0);
  });

  it('sets the tempo from the fourth tap on', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    act(() => {
      (
        byType(tree, 'SegmentedControl')[0]?.props.onSelect as (
          v: string,
        ) => void
      )('tap');
    });
    const tapAt = (timestamp: number) => {
      act(() => {
        (byType(tree, 'TapPad')[0]?.props.onTap as (e: unknown) => void)({
          nativeEvent: { timestamp },
        });
      });
    };
    [0, 1, 2].forEach((tap) => {
      tapAt(tap * TAP_GAP_MS);
    });
    expect(byType(tree, 'TapLeds')[0]?.props.landed).toBe(3);
    expect(
      withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.next).props.disabled,
    ).toBe(true);
    tapAt(3 * TAP_GAP_MS);
    expect(byType(tree, 'NumpadReadout')[0]?.props.digits).toBe('120');
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.next));
    expect(byType(tree, 'Stepper')[0]?.props.value).toBe('120');
  });
});

describe('an analysed song', () => {
  beforeEach(() => {
    manual.analysedBpm = 132;
  });

  it('offers Set tempo manually with the analysed tempo', () => {
    expect(menuRow(openMenu(), SET_TEMPO_TEXT.fix)?.props.value).toBe(
      '132 BPM',
    );
  });

  it('prefills the sheet from the analysis and keeps its bar 1', async () => {
    const tree = openMenu();
    press(only(menuRow(tree, SET_TEMPO_TEXT.fix)));
    expect(
      withProp(tree, 'Sheet', 'title', SET_TEMPO_TEXT.title).props.titleDetail,
    ).toBe('was 132 from analysis');
    press(withProp(tree, 'PresetButton', 'label', '÷2 · 66'));
    press(first(tree, 'NumpadKeypad'), 'onConfirm');
    await save(tree);
    expect(manual.setManualTempo).toHaveBeenCalledWith({ ...MANUAL, bpm: 66 });
    expect(
      withProp(tree, 'Snackbar', 'actionLabel', 'Undo').props.message,
    ).toBe(SET_TEMPO_TEXT.analysedKept);
  });
});

describe('a song with a manual tempo', () => {
  beforeEach(() => {
    manual.tempo = MANUAL;
    manual.analysedBpm = 132;
  });

  it('shows the manual tempo in accent', () => {
    expect(menuRow(openMenu(), SET_TEMPO_TEXT.tempo)?.props).toMatchObject({
      value: '128 BPM',
      valueTone: 'accent',
    });
  });

  it('switches back to the analysed tempo, with Undo', async () => {
    const tree = openMenu();
    await act(async () => {
      (
        only(menuRow(tree, SET_TEMPO_TEXT.useAnalysed)).props.onPress as Press
      )();
      await Promise.resolve();
    });
    expect(manual.useAnalysedTempo).toHaveBeenCalledOnce();
    const undo = withProp(tree, 'Snackbar', 'actionLabel', 'Undo');
    expect(undo.props.message).toBe('Back to the analysed tempo: 132 BPM.');
    press(undo, 'onAction');
    expect(manual.undoTempo).toHaveBeenCalledOnce();
  });

  it('hides the tempo mode and correction rows, which a manual tempo ignores', () => {
    const tree = openMenu();
    expect(byType(tree, 'TempoModeRow')).toHaveLength(0);
    expect(menuRow(tree, 'Tempo correction')).toBeUndefined();
  });

  it('asks before re-analysing, then re-analyses on confirm', () => {
    const tree = openMenu();
    press(only(menuRow(tree, REANALYZE_LABEL)));
    expect(commands.reanalyze).not.toHaveBeenCalled();
    const dialog = first(tree, 'ConfirmDialog');
    expect(dialog.props.body).toContain('128 BPM with bar 1 at 0:02.3');
    press(dialog, 'onConfirm');
    expect(commands.reanalyze).toHaveBeenCalledWith(1);
  });

  it('reports a failed re-analysis and keeps the manual tempo', () => {
    const tree = openMenu();
    confirmReanalyse(tree);
    runAnalysis(tree, ['pending', 'failed']);
    expect(
      withProp(tree, 'Snackbar', 'message', SET_TEMPO_TEXT.reanalysisFailed),
    ).toBeDefined();
    expect(manual.setManualTempo).not.toHaveBeenCalled();
  });

  it('says so when a re-analysis agrees with the manual tempo', () => {
    const tree = openMenu();
    confirmReanalyse(tree);
    manual.analysedBpm = MANUAL.bpm;
    runAnalysis(tree, ['pending', 'done']);
    expect(
      withProp(tree, 'Snackbar', 'message', SET_TEMPO_TEXT.reanalysisAgrees),
    ).toBeDefined();
    expect(manual.offerAnalysed).not.toHaveBeenCalled();
  });

  it('offers the analysed tempo when the run brings back the same grid at another BPM', () => {
    const tree = openMenu();
    confirmReanalyse(tree);
    runAnalysis(tree, ['pending', 'done']);
    expect(manual.offerAnalysed).toHaveBeenCalledOnce();
  });

  it('forgets a re-analysis that could not be queued', async () => {
    commands.reanalyze.mockRejectedValueOnce(new Error('busy'));
    const tree = openMenu();
    confirmReanalyse(tree);
    await act(async () => {
      await Promise.resolve();
    });
    runAnalysis(tree, ['pending', 'failed']);
    expect(
      byType(tree, 'Snackbar').filter(
        (bar) => bar.props.message === SET_TEMPO_TEXT.reanalysisFailed,
      ),
    ).toHaveLength(0);
  });

  it('offers a newer analysed tempo in a snackbar', () => {
    manual.offer = 132;
    const tree = mount();
    const offer = withProp(tree, 'Snackbar', 'actionLabel', 'Use 132');
    press(offer, 'onAction');
    expect(manual.useAnalysedTempo).toHaveBeenCalledOnce();
  });
});
