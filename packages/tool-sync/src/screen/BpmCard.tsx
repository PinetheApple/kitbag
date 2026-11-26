import {
  Badge,
  Card,
  createThemedStyles,
  rowLineHeight,
  space,
  textRoles,
  textStyle,
  useTextScaled,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  NO_TEMPO_NUMERAL,
  shownBpm,
  type TempoLine,
} from '../logic/tempoLine.ts';

const useStyles = createThemedStyles((theme) => ({
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.rowGap,
  },
  side: { flex: 1, gap: space.controlGap },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  sideOwnLine: { flexBasis: '100%' },
  numeral: {
    ...textStyle(textRoles.tempoNumeralTight),
    includeFontPadding: false,
    color: theme.color.text,
  },
  noTempo: { color: theme.color.text3 },
  caption: {
    flex: 1,
    ...textStyle(textRoles.tempoCaption),
    color: theme.color.text2,
  },
  line: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color.text2,
  },
  rung: textStyle(textRoles.rowSubtitleStrong),
  credit: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color[theme.accentInk],
    textDecorationLine: 'underline',
  },
}));

export interface BpmCardProps {
  readonly bpm: number | null;
  readonly line: TempoLine;
  readonly newTrack: boolean;
  readonly onOpenTempo: () => void;
}

function CreditLink({
  name,
  url,
}: {
  readonly name: string;
  readonly url: string;
}) {
  const styles = useStyles();
  const open = useCallback(() => {
    Linking.openURL(url).catch(() => undefined);
  }, [url]);
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={`Tempo from ${name}, open ${url}`}
      style={styles.credit}
      onPress={open}
    >
      {url.replace(/^https:\/\//, '')}
    </Text>
  );
}

export function BpmCard({ bpm, line, newTrack, onOpenTempo }: BpmCardProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const numeral = bpm === null ? NO_TEMPO_NUMERAL : shownBpm(bpm);
  const spoken = `Tempo ${bpm === null ? 'not set' : `${numeral} BPM`}. ${line.lead}${line.rung}`;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint="Opens the tempo sheet"
        style={styles.top}
        onPress={onOpenTempo}
      >
        <Text style={[styles.numeral, bpm === null && styles.noTempo]}>
          {numeral}
        </Text>
        <View style={[styles.side, scaled && styles.sideOwnLine]}>
          <View style={styles.captionRow}>
            <Text style={styles.caption}>BPM</Text>
            {newTrack ? <Badge label="NEW TRACK" tone="accent" /> : null}
            {line.noTempo ? <Badge label="No tempo" tone="warning" /> : null}
          </View>
          <Text style={styles.line}>
            {line.lead}
            <Text style={styles.rung}>{line.rung}</Text>
            {line.tail}
          </Text>
        </View>
      </Pressable>
      {line.credit === null ? null : <CreditLink {...line.credit} />}
    </Card>
  );
}
