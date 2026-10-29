import {
  countLabel,
  createThemedStyles,
  metronomeSheet,
  radius,
  SegmentedControl,
  space,
  StepControl,
  type StepDelta,
  Switch,
} from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import {
  COUNT_IN_SEGMENT_OPTIONS,
  countInBarsFromOption,
  countInMode,
  COUNT_IN_MODE,
  COUNT_IN_MODE_OPTIONS,
  type CountInMode,
} from '../logic/countIn.ts';
import { PracticeSection, usePracticeStyles } from './PracticeSection.tsx';
import { useBarMuteEditor } from './useBarMuteEditor.ts';

const bars = (count: number) => countLabel(count, 'bar', 'bars');

const usePreviewStyles = createThemedStyles((theme) => ({
  preview: {
    flexDirection: 'row',
    gap: space.barPreviewGap,
  },
  cell: {
    flex: 1,
    height: metronomeSheet.mutePreview,
    borderRadius: radius.barPreview,
  },
  playing: {
    backgroundColor: theme.color.text2,
  },
  muted: {
    borderWidth: metronomeSheet.mutePreviewDashed,
    borderStyle: 'dashed',
    borderColor: theme.color.text3,
  },
}));

function MutePreview({ preview }: { readonly preview: readonly boolean[] }) {
  const styles = usePreviewStyles();
  const spoken = preview.map((on) => (on ? 'play' : 'mute')).join(', ');
  return (
    <View
      accessible
      accessibilityLabel={`First ${bars(preview.length)} from start: ${spoken}`}
      style={styles.preview}
    >
      {preview.map((playing, bar) => (
        <View
          key={bar}
          style={[styles.cell, playing ? styles.playing : styles.muted]}
        />
      ))}
    </View>
  );
}

export function PracticeMute() {
  const styles = usePracticeStyles();
  const editor = useBarMuteEditor();
  const { enabled, playBars, muteBars } = editor.barMute;
  return (
    <PracticeSection
      icon="muteBars"
      title="Mute bars"
      heading={
        <>
          <View style={styles.grow} />
          <Switch
            accessibilityLabel="Mute bars"
            value={enabled}
            onValueChange={editor.toggle}
          />
        </>
      }
    >
      <View style={styles.row}>
        <Text style={styles.label}>Play</Text>
        <StepControl
          variant="inlineLarge"
          label="Bars to play"
          value={String(playBars)}
          accessibilityValue={bars(playBars)}
          neighbourGapDp={space.controlGap}
          onStep={editor.stepPlay}
        />
        <View style={styles.grow} />
        <Text style={styles.label}>Mute</Text>
        <StepControl
          variant="inlineLarge"
          label="Bars to mute"
          value={String(muteBars)}
          accessibilityValue={bars(muteBars)}
          neighbourGapDp={space.controlGap}
          onStep={editor.stepMute}
        />
      </View>
      <MutePreview preview={editor.preview} />
    </PracticeSection>
  );
}

export function PracticeCountIn() {
  const styles = usePracticeStyles();
  const countIn = useMetronome((s) => s.countIn);
  const setCountIn = useMetronome((s) => s.setCountIn);
  const handleBars = useCallback(
    (option: string) => {
      setCountIn({ ...countIn, bars: countInBarsFromOption(option) });
    },
    [countIn, setCountIn],
  );
  const handleMode = useCallback(
    (mode: CountInMode) => {
      setCountIn({ ...countIn, distinct: mode === COUNT_IN_MODE.distinct });
    },
    [countIn, setCountIn],
  );
  return (
    <PracticeSection
      icon="countIn"
      title="Count-in"
      heading={
        <View style={styles.headingFill}>
          <SegmentedControl
            size="large"
            accessibilityLabel="Count-in length"
            options={COUNT_IN_SEGMENT_OPTIONS}
            selected={String(countIn.bars)}
            neighbourGapDp={space.controlGap}
            onSelect={handleBars}
          />
        </View>
      }
    >
      <View style={styles.row}>
        <Text style={styles.label}>Count sound</Text>
        <SegmentedControl
          size="large"
          fill
          accessibilityLabel="Count-in sound"
          options={COUNT_IN_MODE_OPTIONS}
          selected={countInMode(countIn.distinct)}
          neighbourGapDp={space.controlGap}
          onSelect={handleMode}
        />
      </View>
    </PracticeSection>
  );
}

export function PracticePoly() {
  const styles = usePracticeStyles();
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const polyEnabled = useMetronome((s) => s.polyEnabled);
  const polyBeats = useMetronome((s) => s.polyBeats);
  const setPoly = useMetronome((s) => s.setPoly);
  const handleStep = useCallback(
    (delta: StepDelta) => {
      setPoly(polyEnabled, polyBeats + delta);
    },
    [polyEnabled, polyBeats, setPoly],
  );
  const handleToggle = useCallback(
    (enabled: boolean) => {
      setPoly(enabled, polyBeats);
    },
    [polyBeats, setPoly],
  );
  return (
    <PracticeSection
      last
      icon="polyrhythm"
      title="Polyrhythm"
      heading={
        <>
          <View style={styles.grow} />
          <StepControl
            variant="inlineLarge"
            label="Polyrhythm"
            value={`${String(polyBeats)} : ${String(beatsPerBar)}`}
            accessibilityValue={`${String(polyBeats)} against ${String(beatsPerBar)}`}
            neighbourGapDp={space.controlGap}
            onStep={handleStep}
          />
          <Switch
            accessibilityLabel="Polyrhythm"
            value={polyEnabled}
            onValueChange={handleToggle}
          />
        </>
      }
    />
  );
}
