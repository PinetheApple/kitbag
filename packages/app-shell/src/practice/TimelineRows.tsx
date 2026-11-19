import {
  Badge,
  createThemedStyles,
  practiceHistory,
  practiceHistoryText,
  radius,
  textStyle,
} from '@kitbag/core-design';
import {
  TIMELINE_ENTRY,
  type TimelineEntry,
  type TimelineStretch,
} from '@kitbag/core-state';
import { useCustomSoundViews } from '@kitbag/tool-metronome';
import { Text, View } from 'react-native';

import { CLICK_ONLY } from './historyText.ts';
import {
  pauseText,
  playClock,
  positionText,
  stretchBadges,
  stretchFacts,
} from './timelineText.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: practiceHistory.timelineGap,
    minHeight: practiceHistory.timelineRowMin,
    paddingBottom: practiceHistory.timelineRowBottom,
  },
  pauseRow: { minHeight: practiceHistory.pauseRowMin, paddingBottom: 0 },
  time: {
    ...textStyle(practiceHistoryText.time),
    width: practiceHistory.timeWidth,
    paddingTop: practiceHistory.timeTop,
    textAlign: 'right',
    color: theme.color.text3,
  },
  rail: { width: practiceHistory.railWidth, alignItems: 'center' },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: practiceHistory.railLine,
    backgroundColor: theme.color.surface3,
  },
  dashed: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: practiceHistory.pauseRailLine,
    borderStyle: 'dashed',
    borderColor: theme.color.decor,
  },
  dot: {
    marginTop: practiceHistory.dotTop,
    width: practiceHistory.dot,
    height: practiceHistory.dot,
    borderRadius: radius.circle,
    backgroundColor: theme.color.text2,
  },
  body: { flex: 1, minWidth: 0, paddingTop: practiceHistory.timelineTextTop },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: practiceHistory.titleNoteGap,
  },
  title: {
    ...textStyle(practiceHistoryText.stretchTitle),
    flexShrink: 1,
    color: theme.color.text,
  },
  place: {
    ...textStyle(practiceHistoryText.stretchPlace),
    color: theme.color.text3,
  },
  facts: {
    ...textStyle(practiceHistoryText.stretchFacts),
    color: theme.color.text2,
  },
  length: {
    ...textStyle(practiceHistoryText.stretchLength),
    paddingTop: practiceHistory.timelineValueTop,
    color: theme.color.text,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: practiceHistory.tagsGap,
    marginTop: practiceHistory.tagsTop,
  },
  pause: {
    ...textStyle(practiceHistoryText.pause),
    paddingTop: practiceHistory.timelineTextTop,
    color: theme.color.text3,
  },
}));

export type SetlistSize = (setlistUuid: string) => number | undefined;

type CustomSounds = ReturnType<typeof useCustomSoundViews>;

function StretchRow({
  entry,
  setlistSize,
  custom,
}: {
  readonly entry: TimelineStretch;
  readonly setlistSize: SetlistSize;
  readonly custom: CustomSounds;
}) {
  const styles = useStyles();
  const { song, setlist } = entry.stretch;
  const place =
    setlist === null
      ? null
      : positionText(setlist.position, setlistSize(setlist.uuid));
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{playClock(entry.atMs)}</Text>
      <View style={styles.rail}>
        <View style={styles.line} />
        <View style={styles.dot} />
      </View>
      <View style={styles.body}>
        <View style={styles.heading}>
          <Text numberOfLines={1} style={styles.title}>
            {song?.title ?? CLICK_ONLY}
          </Text>
          {place === null ? null : <Text style={styles.place}>{place}</Text>}
        </View>
        <Text style={styles.facts}>{stretchFacts(entry, custom)}</Text>
        <Badges labels={stretchBadges(entry)} />
      </View>
      <Text style={styles.length}>{playClock(entry.playedMs)}</Text>
    </View>
  );
}

function Badges({ labels }: { readonly labels: readonly string[] }) {
  const styles = useStyles();
  if (labels.length === 0) return null;
  return (
    <View style={styles.tags}>
      {labels.map((label) => (
        <Badge key={label} variant="list" label={label} />
      ))}
    </View>
  );
}

function PauseRow({ ms }: { readonly ms: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, styles.pauseRow]}>
      <View style={styles.time} />
      <View style={styles.rail}>
        <View style={styles.dashed} />
      </View>
      <Text style={styles.pause}>{pauseText(ms)}</Text>
    </View>
  );
}

export interface TimelineRowsProps {
  readonly entries: readonly TimelineEntry[];
  readonly setlistSize: SetlistSize;
}

export function TimelineRows({ entries, setlistSize }: TimelineRowsProps) {
  const custom = useCustomSoundViews();
  return (
    <View>
      {entries.map((entry, index) =>
        entry.kind === TIMELINE_ENTRY.pause ? (
          <PauseRow key={`pause-${String(index)}`} ms={entry.ms} />
        ) : (
          <StretchRow
            key={`stretch-${String(entry.atMs)}`}
            entry={entry}
            setlistSize={setlistSize}
            custom={custom}
          />
        ),
      )}
    </View>
  );
}
