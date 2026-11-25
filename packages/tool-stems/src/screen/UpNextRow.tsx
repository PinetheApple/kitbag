import {
  Button,
  createThemedStyles,
  miniPlayer,
  minTouchTargetDp,
  nextUpLabel,
  QUEUE_TEXT,
  size,
  stemPlayer,
  textRoles,
  textStyle,
  TransportKey,
  useTextScaled,
} from '@kitbag/core-design';
import {
  PREVIOUS_RESTARTS_AFTER_SECONDS,
  REPEAT,
  useCanGoBack,
  usePlayOrder,
  useLibrarySongs,
  useRepeatMode,
  useShownLoopHeld,
  useShownSong,
  useStage,
  useUpNext,
} from '@kitbag/core-state';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  repeatedText,
  upNextText,
  type UpNextText,
} from '../logic/upNextText.ts';
import { RepeatChip } from './RepeatChip.tsx';

export const UP_NEXT = 'Up next';
export const REPEAT_LINE_ID = 'up-next-repeat-line';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: miniPlayer.gap,
    minHeight: minTouchTargetDp,
  },
  controlsOnly: { justifyContent: 'space-between' },
  divided: {
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  repeatLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: miniPlayer.gap,
    paddingLeft: stemPlayer.transportKey + miniPlayer.gap,
  },
  text: { flex: 1, minWidth: 0 },
  label: {
    ...textStyle(textRoles.sectionLabel),
    color: theme.color[theme.accentInk],
  },
  title: { ...textStyle(textRoles.rowTitle), color: theme.color.text },
  source: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
}));

function usePastRestart(songSec: SharedValue<number>): boolean {
  const [past, setPast] = useState(false);
  useAnimatedReaction(
    () => songSec.value > PREVIOUS_RESTARTS_AFTER_SECONDS,
    (now, before) => {
      if (now !== before) scheduleOnRN(setPast, now);
    },
    [songSec],
  );
  return past;
}

interface UpNextRowText {
  readonly shown: UpNextText;
  readonly next: UpNextText;
}

function useUpNextRowText(): UpNextRowText | null {
  const upNext = useUpNext();
  const queueLength = usePlayOrder((s) => s.queue.length);
  const { stage, name } = useStage();
  const library = useLibrarySongs();
  const repeatsOne = useRepeatMode() === REPEAT.one;
  const playing = useShownSong();
  const loopHeld = useShownLoopHeld();
  if (upNext === undefined) return null;
  const next = upNextText(upNext, {
    queueLength,
    stage,
    setlistName: name,
    library,
  });
  if (repeatsOne && playing !== null)
    return { shown: repeatedText(playing, library, loopHeld), next };
  return { shown: next, next };
}

export interface UpNextRowProps {
  readonly songSec: SharedValue<number>;
  readonly onOpenSheet: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
}

function NextKey({
  text,
  onNext,
}: { readonly text: UpNextText } & Pick<UpNextRowProps, 'onNext'>) {
  if (text.metronome)
    return (
      <Button
        size="prompt"
        variant="tonal"
        icon="metronome"
        iconSize="action"
        label={QUEUE_TEXT.open}
        onPress={onNext}
      />
    );
  return (
    <TransportKey
      size="dock"
      icon="next"
      accessibilityLabel={nextUpLabel(text.title)}
      onPress={onNext}
    />
  );
}

function PreviousKey({
  songSec,
  onPrevious,
}: Pick<UpNextRowProps, 'songSec' | 'onPrevious'>) {
  const canGoBack = useCanGoBack();
  const pastRestart = usePastRestart(songSec);
  return (
    <TransportKey
      size="dock"
      icon="previous"
      accessibilityLabel={QUEUE_TEXT.previous}
      disabled={!canGoBack && !pastRestart}
      onPress={onPrevious}
    />
  );
}

interface TextRowProps extends Omit<UpNextRowProps, 'songSec' | 'onPrevious'> {
  readonly previous: ReactNode;
  readonly text: UpNextText;
  readonly next: UpNextText;
}

function TextRow({ previous, text, next, onOpenSheet, onNext }: TextRowProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const nextKey = <NextKey text={next} onNext={onNext} />;
  const openOnRepeatLine = scaled && next.metronome;
  const line = (
    <View style={[styles.row, !scaled && styles.divided]}>
      {previous}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${UP_NEXT}: ${text.title}, ${text.source}`}
        accessibilityHint="Opens the queue"
        style={styles.text}
        onPress={onOpenSheet}
      >
        <Text style={styles.label} numberOfLines={1}>
          {UP_NEXT}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {text.title}
        </Text>
        <Text style={styles.source} numberOfLines={1}>
          {text.source}
        </Text>
      </Pressable>
      {scaled ? null : <RepeatChip />}
      {openOnRepeatLine ? null : nextKey}
    </View>
  );
  if (!scaled) return line;
  return (
    <View style={styles.divided}>
      {line}
      <View testID={REPEAT_LINE_ID} style={styles.repeatLine}>
        <RepeatChip />
        {openOnRepeatLine ? nextKey : null}
      </View>
    </View>
  );
}

export function UpNextRow({ songSec, onPrevious, ...presses }: UpNextRowProps) {
  const styles = useStyles();
  const text = useUpNextRowText();
  const previous = <PreviousKey songSec={songSec} onPrevious={onPrevious} />;
  if (text === null)
    return (
      <View style={[styles.row, styles.controlsOnly, styles.divided]}>
        {previous}
        <RepeatChip />
      </View>
    );
  return (
    <TextRow
      previous={previous}
      text={text.shown}
      next={text.next}
      {...presses}
    />
  );
}
