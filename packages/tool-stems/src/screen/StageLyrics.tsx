import {
  createThemedStyles,
  stemSections,
  stemSectionsText,
  textStyle,
  useReduceMotion,
} from '@kitbag/core-design';
import { lyricLineAt, NO_LINE, useStemPlayer } from '@kitbag/core-state';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { lyricRows } from '../logic/lyricRows.ts';

export const useLyricStyles = createThemedStyles((theme) => ({
  view: { flex: 1, minHeight: 0 },
  content: { paddingLeft: stemSections.linesLeft },
  heading: {
    ...textStyle(stemSectionsText.label),
    color: theme.color.text2,
    marginTop: stemSections.headingTop,
    marginBottom: stemSections.headingBottom,
  },
  line: {
    ...textStyle(stemSectionsText.stageLine),
    lineHeight: stemSections.stageLineHeight,
    color: theme.color.text2,
  },
  current: {
    ...textStyle(stemSectionsText.stageCurrent),
    lineHeight: stemSectionsText.stageCurrent.size * stemSections.currentRatio,
    color: theme.color.text,
  },
  currentRow: { marginVertical: stemSections.currentMargin },
  bar: {
    position: 'absolute',
    left: -stemSections.linesLeft,
    top: stemSections.currentBarInset,
    bottom: stemSections.currentBarInset,
    width: stemSections.currentBarWidth,
    borderRadius: stemSections.currentBarRadius,
    backgroundColor: theme.color.accent,
  },
}));

interface LineRowProps {
  readonly line: number;
  readonly text: string;
  readonly current: boolean;
  readonly onCurrentLayout: (y: number) => void;
}

const LineRow = memo(function LineRow({
  line,
  text,
  current,
  onCurrentLayout,
}: LineRowProps) {
  const styles = useLyricStyles();
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (current) onCurrentLayout(event.nativeEvent.layout.y);
    },
    [current, onCurrentLayout],
  );
  return (
    <View
      testID={`lyric-line-${String(line)}`}
      style={current && styles.currentRow}
      onLayout={onLayout}
    >
      {current ? <View style={styles.bar} /> : null}
      <Text style={[styles.line, current && styles.current]}>{text}</Text>
    </View>
  );
});

// Crossing into another line is the only thing that reaches JS (SPEC §13.3).
export function StageLyrics({
  songSec,
}: {
  readonly songSec: SharedValue<number>;
}) {
  const styles = useLyricStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const sections = useStemPlayer((s) => s.sections);
  const reduceMotion = useReduceMotion();
  const rows = useMemo(() => lyricRows(lines, sections), [lines, sections]);
  const [current, setCurrent] = useState(NO_LINE);
  useAnimatedReaction(
    () => lyricLineAt(lines, songSec.value),
    (now, before) => {
      if (now !== before) scheduleOnRN(setCurrent, now);
    },
    [lines, songSec],
  );
  const list = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const onViewport = useCallback((event: LayoutChangeEvent) => {
    viewport.current = event.nativeEvent.layout.height;
  }, []);
  // A line changes height as it becomes current, so this fires on every crossing.
  const follow = useCallback(
    (y: number) => {
      list.current?.scrollTo({
        y: Math.max(0, y - viewport.current * stemSections.followAt),
        animated: !reduceMotion,
      });
    },
    [reduceMotion],
  );
  return (
    <ScrollView
      ref={list}
      testID="stage-lyrics"
      style={styles.view}
      contentContainerStyle={styles.content}
      onLayout={onViewport}
    >
      {rows.map((row) =>
        row.kind === 'heading' ? (
          <Text key={row.key} style={styles.heading}>
            {row.text}
          </Text>
        ) : (
          <LineRow
            key={row.key}
            line={row.line}
            text={row.text}
            current={row.line === current}
            onCurrentLayout={follow}
          />
        ),
      )}
    </ScrollView>
  );
}
