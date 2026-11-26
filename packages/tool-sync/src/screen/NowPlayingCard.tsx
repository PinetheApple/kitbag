import {
  Card,
  createThemedStyles,
  DrawnFigures,
  opacity,
  RowIcon,
  rowLineHeight,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { Text, View } from 'react-native';

import { artistLead, UNKNOWN_TITLE } from '../logic/nowPlaying.ts';

const useStyles = createThemedStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
  greyed: { opacity: opacity.muted },
  text: { flex: 1 },
  title: {
    ...textStyle(textRoles.rowTitle),
    lineHeight: rowLineHeight.title,
    color: theme.color.text,
  },
  detail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  artist: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color.text2,
  },
}));

export interface NowPlayingCardProps {
  readonly title: string | null;
  readonly artist: string | null;
  readonly clock: string | null;
  readonly greyed: boolean;
}

export function NowPlayingCard({
  title,
  artist,
  clock,
  greyed,
}: NowPlayingCardProps) {
  const styles = useStyles();
  return (
    <View style={greyed ? styles.greyed : null}>
      <Card>
        <View style={styles.row}>
          <RowIcon icon="song" />
          <View style={styles.text}>
            <Text style={styles.title}>{title ?? UNKNOWN_TITLE}</Text>
            <View style={styles.detail}>
              <Text style={styles.artist}>
                {clock === null ? (artist ?? '') : artistLead(artist)}
              </Text>
              {clock === null ? null : (
                <DrawnFigures text={clock} role="rowSubtitle" color="text2" />
              )}
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}
