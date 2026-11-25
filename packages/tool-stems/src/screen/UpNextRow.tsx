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
export const REPEAT_LINE_ID = 'up-next-repeat-line';

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
  },
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
  readonly next: UpNextText | null;
}

function useUpNextRowText(): UpNextRowText {
  const upNext = useUpNext();
  const queueLength = usePlayOrder((s) => s.queue.length);
  const { stage, name } = useStage();
  const library = useLibrarySongs();
  const mode = useRepeatMode();
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
  const playsAgain =
    mode === REPEAT.one || (mode === REPEAT.all && upNext === undefined);
  if (playsAgain && playing !== null)
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
  const scaled = useTextScaled();
  const nextKey =
    next === null ? null : <NextKey text={next} onNext={onNext} />;
  const openOnRepeatLine = scaled && next?.metronome === true;
  const line = (
    <View style={[styles.row, !scaled && styles.divided]}>
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
