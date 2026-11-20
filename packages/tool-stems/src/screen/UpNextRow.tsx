import {
  Button,
  createThemedStyles,
  miniPlayer,
  minTouchTargetDp,
  nextUpLabel,
  QUEUE_TEXT,
  size,
  textRoles,
  textStyle,
  TransportKey,
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
import { useState } from 'react';
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

const NOTHING_NEXT: UpNextText = {
  title: QUEUE_TEXT.nothingQueued,
  source: QUEUE_TEXT.playbackStops,
  metronome: false,
};

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: miniPlayer.gap,
    minHeight: minTouchTargetDp,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
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
  readonly next: UpNextText | null;
}

function useUpNextRowText(): UpNextRowText {
  const upNext = useUpNext();
  const queueLength = usePlayOrder((s) => s.queue.length);
  const { stage, name } = useStage();
  const library = useLibrarySongs();
  const repeatsOne = useRepeatMode() === REPEAT.one;
  const playing = useShownSong();
  const loopHeld = useShownLoopHeld();
  const next =
    upNext === undefined
      ? null
      : upNextText(upNext, {
          queueLength,
          stage,
          setlistName: name,
          library,
        });
  if (repeatsOne && playing !== null)
    return { shown: repeatedText(playing, library, loopHeld), next };
  return { shown: next ?? NOTHING_NEXT, next };
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

export function UpNextRow({
  songSec,
  onOpenSheet,
  onNext,
  onPrevious,
}: UpNextRowProps) {
  const styles = useStyles();
  const { shown: text, next } = useUpNextRowText();
  const canGoBack = useCanGoBack();
  const pastRestart = usePastRestart(songSec);
  return (
    <View style={styles.row}>
      <TransportKey
        size="dock"
        icon="previous"
        accessibilityLabel={QUEUE_TEXT.previous}
        disabled={!canGoBack && !pastRestart}
        onPress={onPrevious}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${UP_NEXT}: ${text.title}, ${text.source}`}
        accessibilityHint="Opens the queue"
        style={styles.text}
        onPress={onOpenSheet}
      >
        <Text style={styles.label}>{UP_NEXT}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {text.title}
        </Text>
        <Text style={styles.source} numberOfLines={1}>
          {text.source}
        </Text>
      </Pressable>
      <RepeatChip />
      {next === null ? null : <NextKey text={next} onNext={onNext} />}
    </View>
  );
}
