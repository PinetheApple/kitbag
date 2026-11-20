import {
  createThemedStyles,
  practiceHistory,
  practiceHistoryText,
  radii,
  size,
  textStyle,
} from '@kitbag/core-design';
import {
  longestBar,
  type GraphBar,
  type HistoryGrouping,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDuration } from '../settings/practiceText.ts';
import { dayMonth } from './dates.ts';
import { graphCaption, graphLabels } from './historyText.ts';

const useStyles = createThemedStyles((theme) => ({
  card: {
    gap: practiceHistory.graphGap,
    paddingTop: practiceHistory.graphTop,
    paddingHorizontal: practiceHistory.graphH,
    paddingBottom: practiceHistory.graphBottom,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  bars: {
    height: practiceHistory.barsHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: practiceHistory.barGap,
  },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: {
    borderRadius: practiceHistory.barRadius,
    backgroundColor: theme.color.text2,
  },
  labels: { flexDirection: 'row', gap: practiceHistory.barGap },
  label: {
    ...textStyle(practiceHistoryText.graphLabel),
    flex: 1,
    textAlign: 'center',
    color: theme.color.text3,
  },
  now: {
    ...textStyle(practiceHistoryText.graphLabelNow),
    color: theme.color.text,
  },
  caption: {
    ...textStyle(practiceHistoryText.graphCaption),
    color: theme.color.text2,
  },
}));

function barHeight(seconds: number, most: number): number {
  if (most === 0) return practiceHistory.barMinHeight;
  return Math.max(
    practiceHistory.barMinHeight,
    (seconds / most) * practiceHistory.barsHeight,
  );
}

interface BarProps {
  readonly bar: GraphBar;
  readonly most: number;
  readonly onPress: (start: Date) => void;
}

function Bar({ bar, most, onPress }: BarProps) {
  const styles = useStyles();
  const press = useCallback(() => {
    onPress(bar.start);
  }, [onPress, bar.start]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dayMonth(bar.start)}, ${formatDuration(bar.seconds)}`}
      disabled={bar.seconds === 0}
      style={styles.slot}
      onPress={press}
    >
      <View style={[styles.bar, { height: barHeight(bar.seconds, most) }]} />
    </Pressable>
  );
}

export interface HistoryGraphProps {
  readonly bars: readonly GraphBar[];
  readonly grouping: HistoryGrouping;
  readonly onBarPress: (start: Date) => void;
}

export function HistoryGraph({
  bars,
  grouping,
  onBarPress,
}: HistoryGraphProps) {
  const styles = useStyles();
  const most = longestBar(bars);
  const labels = graphLabels(bars, grouping);
  return (
    <View style={styles.card}>
      <View style={styles.bars}>
        {bars.map((bar) => (
          <Bar
            key={bar.start.getTime()}
            bar={bar}
            most={most}
            onPress={onBarPress}
          />
        ))}
      </View>
      <View
        style={styles.labels}
        importantForAccessibility="no-hide-descendants"
      >
        {bars.map((bar, index) => (
          <Text
            key={bar.start.getTime()}
            numberOfLines={1}
            style={[styles.label, bar.current && styles.now]}
          >
            {labels[index]}
          </Text>
        ))}
      </View>
      <Text style={styles.caption}>{graphCaption(bars, grouping)}</Text>
    </View>
  );
}
