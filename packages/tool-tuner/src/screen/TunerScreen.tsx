import {
  AppBar,
  Chip,
  createThemedStyles,
  inset,
  LiveText,
  PegSelector,
  space,
  TuneDirectionIcon,
  TunerStrip,
  unshared,
} from '@kitbag/core-design';
import { confirmHaptic } from '@kitbag/core-native';
import {
  tuningFromCustom,
  useTuner,
  type CustomTuning,
  type TunerTuning,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { a4Label, effectiveA4, type A4Range } from '../logic/a4.ts';
import { tunerHint, type HintAction } from '../logic/hints.ts';
import { QUIET_DISCRETE, type TunerDiscrete } from '../logic/hop.ts';
import { spokenNoteName } from '../logic/notes.ts';
import { statusSpeech } from '../logic/readout.ts';
import {
  DEFAULT_TUNING,
  draftFrom,
  pegItems,
  tuningLabel,
  type TuningDraft,
} from '../logic/tunings.ts';
import { A4Sheet } from './A4Sheet.tsx';
import { TunerHintCard } from './TunerHintCard.tsx';
import { TuningEditorSheet } from './TuningEditorSheet.tsx';
import { TuningSheet } from './TuningSheet.tsx';
import { useTunerFrame } from './useTunerFrame.ts';

// The tuning chip tops the app bar; the mode chips sit between the needle
// strip, which takes no touches, and the screen's bottom inset.
const TUNING_CHIP_GAPS = {
  top: unshared(inset.appBar + space.screenInset),
  bottom: unshared(inset.appBar) + space.sectionGap,
};
const MODE_CHIP_GAPS = {
  top: unshared(space.sectionGap),
  bottom: unshared(space.screenInset),
};

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: space.screenInset,
    gap: space.sectionGap,
  },
  spacer: {
    flex: 1,
  },
  readout: {
    alignItems: 'center',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
}));

type Sheet = 'none' | 'tunings' | 'editor' | 'a4';

interface Editing {
  readonly draft: TuningDraft;
  readonly id?: number;
}

export interface ShellMeasuredInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface TunerScreenProps {
  readonly insets: ShellMeasuredInsets;
  /** The engine's A4 range and default: pass core-native's KB_TUNER_A4_HZ. */
  readonly a4Range: A4Range;
  /** Omit to draw no back control. */
  readonly onBack?: () => void;
}

// The tuner screen (SPEC §10.2, design/kitbag-ui.html TUNER). The shell owns
// the store's enter/leave around focus; this screen only renders and dispatches.
export function TunerScreen({ insets, a4Range, onBack }: TunerScreenProps) {
  const styles = useStyles();

  const open = useTuner((s) => s.open);
  const mode = useTuner((s) => s.mode);
  const tuning = useTuner((s) => s.tuning) ?? DEFAULT_TUNING;
  const a4Hz = useTuner((s) => s.a4Hz);
  const tunedStrings = useTuner((s) => s.tunedStrings);
  const permission = useTuner((s) => s.permission);
  const mic = useTuner((s) => s.mic);
  const customTunings = useTuner((s) => s.customTunings);

  const setAuto = useTuner((s) => s.setAuto);
  const lockString = useTuner((s) => s.lockString);
  const setChromatic = useTuner((s) => s.setChromatic);
  const setTuning = useTuner((s) => s.setTuning);
  const setA4 = useTuner((s) => s.setA4);
  const markTuned = useTuner((s) => s.markTuned);
  const retryMic = useTuner((s) => s.retryMic);
  const loadCustomTunings = useTuner((s) => s.loadCustomTunings);
  const createCustomTuning = useTuner((s) => s.createCustomTuning);
  const updateCustomTuning = useTuner((s) => s.updateCustomTuning);
  const deleteCustomTuning = useTuner((s) => s.deleteCustomTuning);

  const chromatic = mode.kind === 'chromatic';
  const lockedIndex = mode.kind === 'manual' ? mode.string : null;

  // What React knows about the reading: human-speed only (§13.3).
  const [discrete, setDiscrete] = useState<TunerDiscrete>(QUIET_DISCRETE);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [editing, setEditing] = useState<Editing>(() => ({
    draft: draftFrom(DEFAULT_TUNING, ''),
  }));
  const [loadFailed, setLoadFailed] = useState(false);

  const handleLocked = useCallback(
    (stringIndex: number) => {
      if (markTuned(stringIndex)) confirmHaptic();
    },
    [markTuned],
  );

  const handleReset = useCallback(() => {
    setDiscrete(QUIET_DISCRETE);
  }, []);

  // What the engine measures against; a rename changes none of it.
  const resetKey = `${String(open)}|${tuning.notes.join(',')}|${String(tuning.instrument)}|${mode.kind}`;

  const { needle, active, detectedIndex, noteText, captionText, direction } =
    useTunerFrame({
      listening: mic === 'listening',
      resetKey,
      chromatic,
      onLocked: handleLocked,
      onDiscrete: setDiscrete,
      onReset: handleReset,
    });

  const pegs = useMemo(
    () => pegItems(tuning.notes, tunedStrings),
    [tuning.notes, tunedStrings],
  );

  const hint = tunerHint({
    permission,
    mic,
    mode: mode.kind,
    notes: tuning.notes,
    discrete,
  });

  const heard = discrete.heard;
  const readoutLabel = heard
    ? `${spokenNoteName(discrete.targetMidi)}. ${statusSpeech(discrete.status)}`
    : 'No note';

  const a4 = effectiveA4(a4Hz, a4Range);

  const handlePeg = useCallback(
    (index: number) => {
      if (lockedIndex === index) setAuto();
      else lockString(index);
    },
    [lockedIndex, lockString, setAuto],
  );

  const handleChromatic = useCallback(() => {
    if (chromatic) setAuto();
    else setChromatic();
  }, [chromatic, setAuto, setChromatic]);

  const handleHintAction = useCallback(
    (action: HintAction) => {
      if (action === 'openSettings') {
        Linking.openSettings().catch(() => undefined);
        return;
      }
      retryMic();
    },
    [retryMic],
  );

  const closeSheet = useCallback(() => {
    setSheet('none');
  }, []);
  const openTunings = useCallback(() => {
    setSheet('tunings');
  }, []);
  const openA4 = useCallback(() => {
    setSheet('a4');
  }, []);

  const handleTuningsShow = useCallback(() => {
    loadCustomTunings().then(
      () => {
        setLoadFailed(false);
      },
      () => {
        setLoadFailed(true);
      },
    );
  }, [loadCustomTunings]);

  const handleSelectTuning = useCallback(
    (next: TunerTuning) => {
      setTuning(next);
      setSheet('none');
    },
    [setTuning],
  );

  const handleNewTuning = useCallback(() => {
    setEditing({ draft: draftFrom(tuning, '') });
    setSheet('editor');
  }, [tuning]);

  const handleEditTuning = useCallback((row: CustomTuning) => {
    setEditing({
      draft: draftFrom(tuningFromCustom(row), row.name),
      id: row.id,
    });
    setSheet('editor');
  }, []);

  const handleSave = useCallback(
    async (draft: TuningDraft) => {
      const values = {
        name: draft.name.trim(),
        instrument: draft.instrument,
        notes: [...draft.notes],
      };
      if (editing.id === undefined) {
        const row = await createCustomTuning(values);
        setTuning(tuningFromCustom(row));
      } else {
        await updateCustomTuning(editing.id, values);
      }
    },
    [editing.id, createCustomTuning, updateCustomTuning, setTuning],
  );

  const handleDelete = useCallback(async () => {
    if (editing.id !== undefined) await deleteCustomTuning(editing.id);
  }, [editing.id, deleteCustomTuning]);

  const edgeToEdgePadding = useMemo(
    () => ({
      paddingTop: space.screenInset + insets.top,
      paddingBottom: space.screenInset + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );

  return (
    <View style={[styles.screen, edgeToEdgePadding]}>
      <AppBar
        title="Tuner"
        {...(onBack === undefined ? {} : { onBack })}
        trailing={
          <Chip
            active
            label={tuningLabel(tuning)}
            accessibilityLabel={`Tuning: ${tuningLabel(tuning)}. Change tuning`}
            neighbourGapDp={TUNING_CHIP_GAPS}
            onPress={openTunings}
          />
        }
      />

      {chromatic ? null : (
        <PegSelector
          pegs={pegs}
          detectedIndex={detectedIndex}
          lockedIndex={lockedIndex}
          onPress={handlePeg}
        />
      )}

      {hint === undefined ? null : (
        <TunerHintCard hint={hint} onAction={handleHintAction} />
      )}

      <View style={styles.spacer} />

      <View
        accessible
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={readoutLabel}
        style={styles.readout}
      >
        <LiveText
          text={noteText}
          role="tunerNote"
          color={heard ? 'text' : 'text3'}
        />
        <View style={styles.captionRow}>
          <LiveText
            text={captionText}
            role="tunerCaption"
            color={heard ? 'text2' : 'text3'}
          />
          <TuneDirectionIcon
            direction={direction}
            color={heard ? 'text2' : 'text3'}
          />
        </View>
      </View>

      <TunerStrip needle={needle} active={active} />

      <View style={styles.chips}>
        <Chip
          label="Auto"
          active={mode.kind === 'auto'}
          neighbourGapDp={MODE_CHIP_GAPS}
          onPress={setAuto}
        />
        <Chip
          label={a4Label(a4)}
          accessibilityLabel={`A4 reference, ${String(a4)} hertz`}
          neighbourGapDp={MODE_CHIP_GAPS}
          onPress={openA4}
        />
        <Chip
          label="Chromatic"
          active={chromatic}
          neighbourGapDp={MODE_CHIP_GAPS}
          onPress={handleChromatic}
        />
      </View>

      <TuningSheet
        visible={sheet === 'tunings'}
        current={tuning}
        customTunings={customTunings}
        loadFailed={loadFailed}
        bottomInset={insets.bottom}
        onShow={handleTuningsShow}
        onSelect={handleSelectTuning}
        onEdit={handleEditTuning}
        onNew={handleNewTuning}
        onDismiss={closeSheet}
      />
      <TuningEditorSheet
        visible={sheet === 'editor'}
        initial={editing.draft}
        isNew={editing.id === undefined}
        bottomInset={insets.bottom}
        onSave={handleSave}
        onDelete={handleDelete}
        onDismiss={closeSheet}
      />
      <A4Sheet
        visible={sheet === 'a4'}
        hz={a4}
        range={a4Range}
        bottomInset={insets.bottom}
        onChange={setA4}
        onDismiss={closeSheet}
      />
    </View>
  );
}
