import {
  Button,
  createThemedStyles,
  miniPlayer,
  minTouchTargetDp,
  nextUpLabel,
  size,
  textRoles,
  textStyle,
  TransportKey,
} from '@kitbag/core-design';
import {
  usePlayOrder,
  useStage,
  useStemSongs,
  useUpNext,
} from '@kitbag/core-state';
import { Pressable, Text, View } from 'react-native';

import { upNextText } from '../logic/upNextText.ts';

export const UP_NEXT = 'Up next';

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

export interface UpNextRowProps {
  readonly onOpenSheet: () => void;
  readonly onNext: () => void;
}

export function UpNextRow({ onOpenSheet, onNext }: UpNextRowProps) {
  const styles = useStyles();
  const next = useUpNext();
  const queueLength = usePlayOrder((s) => s.queue.length);
  const { stage, name } = useStage();
  const stems = useStemSongs();
  if (next === undefined) return null;
  const text = upNextText(next, {
    queueLength,
    stage,
    setlistName: name,
    stems,
  });
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${UP_NEXT}: ${text.title}, ${text.source}`}
        accessibilityHint="Opens Up next"
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
      {text.metronome ? (
        <Button
          size="prompt"
          variant="tonal"
          icon="metronome"
          iconSize="action"
          label="Open"
          onPress={onNext}
        />
      ) : (
        <TransportKey
          size="dock"
          icon="next"
          accessibilityLabel={nextUpLabel(text.title)}
          onPress={onNext}
        />
      )}
    </View>
  );
}
