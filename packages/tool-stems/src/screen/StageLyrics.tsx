import {
  createThemedStyles,
  stemSections,
  stemSectionsText,
  textStyle,
  useReduceMotion,
} from '@kitbag/core-design';
import { lyricLineAt, NO_LINE, useStemPlayer } from '@kitbag/core-state';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { followedLine, lyricRows } from '../logic/lyricRows.ts';
import { useCrossedIndex } from './useCrossedIndex.ts';

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
    lineHeight:
      stemSectionsText.stageCurrent.size * stemSections.currentLineRatio,
    color: theme.color.text,
  },
  currentRow: { marginVertical: stemSections.currentMargin },
}));

interface LineRowProps {
  readonly line: number;
  readonly text: string;
  readonly current: boolean;
  readonly followed: boolean;
  readonly onRowLayout: (line: number, y: number, followed: boolean) => void;
}

const LineRow = memo(function LineRow({
  line,
  text,
  current,
  followed,
  onRowLayout,
}: LineRowProps) {
  const styles = useLyricStyles();
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onRowLayout(line, event.nativeEvent.layout.y, followed);
    },
    [line, followed, onRowLayout],
  );
  return (
    <View
      testID={`lyric-line-${String(line)}`}
      style={current && styles.currentRow}
      onLayout={onLayout}
    >
      <Text style={[styles.line, current && styles.current]}>{text}</Text>
    </View>
  );
});

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
  const current = useCrossedIndex(songSec, lines, lyricLineAt, NO_LINE);
  const followed = followedLine(lines, current);
  const list = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const rowTops = useRef(new Map<number, number>());
  const onViewport = useCallback((event: LayoutChangeEvent) => {
    viewport.current = event.nativeEvent.layout.height;
  }, []);
  const scrollToRow = useCallback(
    (y: number) => {
      list.current?.scrollTo({
        y: Math.max(0, y - viewport.current * stemSections.followAtFraction),
        animated: !reduceMotion,
      });
    },
    [reduceMotion],
  );
  // A line grows as it becomes current, so its layout event is what drives the follow scroll.
  const onRowLayout = useCallback(
    (line: number, y: number, isFollowed: boolean) => {
      rowTops.current.set(line, y);
      if (isFollowed) scrollToRow(y);
    },
    [scrollToRow],
  );
  // A blank line or no line has no row, so no layout fires.
  const onSungLine = followed === current && current !== NO_LINE;
  useEffect(() => {
    const y = followed === NO_LINE ? 0 : rowTops.current.get(followed);
    if (!onSungLine && y !== undefined) scrollToRow(y);
  }, [onSungLine, followed, scrollToRow]);
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
            followed={row.line === followed}
            onRowLayout={onRowLayout}
          />
        ),
      )}
    </ScrollView>
  );
}
