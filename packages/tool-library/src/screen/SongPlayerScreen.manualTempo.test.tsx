// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  NUDGE_MS,
  SET_TEMPO_STEP,
  type PreviewClickProps,
  type SetTempo,
} from '@kitbag/core-design';
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

const MANUAL = { bpm: 128, anchor: 2.3, beatsPerBar: 4 };

interface SheetProps {
  readonly tempo: SetTempo;
  readonly previewClick: PreviewClickProps;
  readonly onClose: () => void;
}
const NO_GRID = { analysisStatus: 'failed', beats: [] };
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

function setTempoSheet(tree: ReactTestRenderer): SheetProps {
  return first(tree, 'SetTempoSheet').props as SheetProps;
}

function drive(tree: ReactTestRenderer, move: (tempo: SetTempo) => void) {
  act(() => {
    move(setTempoSheet(tree).tempo);
  });
}

function typeTempo(tree: ReactTestRenderer, digits: readonly number[]) {
  for (const digit of digits)
    drive(tree, (tempo) => {
      tempo.entry.onDigit(digit);
    });
  drive(tree, (tempo) => {
    tempo.onTyped();
  });
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
  await act(async () => {
    setTempoSheet(tree).tempo.onSave();
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

  it('opens the shared Set tempo sheet at step 1 with nothing to prefill', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    const { tempo } = setTempoSheet(tree);
    expect(tempo.step).toBe(SET_TEMPO_STEP.tempo);
    expect(tempo.seed).toMatchObject({ bpm: null, analysed: false });
  });

  it('saves a typed tempo with bar 1 at the playhead and offers Undo, leaving the click as the Preview chip shows it', async () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    manual.playheadSeconds = 2.3;
    drive(tree, (tempo) => {
      tempo.onBarOneHere();
    });
    await save(tree);
    expect(manual.setManualTempo).toHaveBeenCalledWith(MANUAL);
    expect(transport.toggleClick).not.toHaveBeenCalled();
    expect(byType(tree, 'SetTempoSheet')).toHaveLength(0);
    const undo = withProp(tree, 'Snackbar', 'actionLabel', 'Undo');
    expect(undo.props.message).toBe('Tempo set: 128 BPM, bar 1 at 0:02.3.');
    press(undo, 'onAction');
    expect(manual.undoTempo).toHaveBeenCalledOnce();
  });

  it('keeps the sheet open and marks the save failed when the tempo is not stored', async () => {
    manual.setManualTempo.mockResolvedValueOnce(false);
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [9, 0]);
    await save(tree);
    const { tempo } = setTempoSheet(tree);
    expect(tempo.failed).toBe(true);
    expect(tempo.step).toBe(SET_TEMPO_STEP.barOne);
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
    drive(tree, (tempo) => {
      tempo.onNudge(NUDGE_MS);
    });
    expect(manual.previewTempo).toHaveBeenLastCalledWith({
      ...MANUAL,
      anchor: 2.31,
    });
    drive(tree, (tempo) => {
      tempo.onBack();
    });
    expect(manual.previewTempo).toHaveBeenLastCalledWith(null);
    expect(manual.setManualTempo).not.toHaveBeenCalled();
  });

  it('plays the click against the song from the Preview click chip', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    const { previewClick } = setTempoSheet(tree);
    expect(previewClick.on).toBe(false);
    act(() => {
      previewClick.onToggle();
    });
    expect(transport.toggleClick).toHaveBeenCalledOnce();
  });

  it('drops the preview when the sheet is closed', () => {
    const tree = mount();
    press(withProp(tree, 'Button', 'label', SET_TEMPO_TEXT.title));
    typeTempo(tree, [1, 2, 8]);
    act(() => {
      setTempoSheet(tree).onClose();
    });
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
    expect(byType(tree, 'SetTempoSheet')).toHaveLength(0);
    expect(
      byType(tree, 'Snackbar').filter(
        (bar) => bar.props.actionLabel === 'Undo',
      ),
    ).toHaveLength(0);
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
    expect(setTempoSheet(tree).tempo.seed).toEqual({
      bpm: 132,
      anchor: MANUAL.anchor,
      beatsPerBar: MANUAL.beatsPerBar,
      analysed: true,
    });
    drive(tree, (tempo) => {
      tempo.entry.onHalve();
    });
    drive(tree, (tempo) => {
      tempo.onTyped();
    });
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
