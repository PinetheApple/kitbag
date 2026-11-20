import {
  createThemedStyles,
  EllipsizedText,
  practiceHistory,
  practiceHistoryText,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { View } from 'react-native';

import { missingSongsText } from './detailText.ts';
import type { SongTitle } from './historyText.ts';

const useStyles = createThemedStyles((theme) => ({
  list: { marginHorizontal: -space.screenInset },
  row: {
    minHeight: practiceHistory.tightRowHeight,
    justifyContent: 'center',
    paddingHorizontal: space.screenInset,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  title: { ...textStyle(textRoles.listTitle), color: theme.color.text },
  gone: { ...textStyle(practiceHistoryText.gone), color: theme.color.text2 },
}));

export interface OldSessionSongsProps {
  readonly songUuids: readonly string[];
  readonly songTitle: SongTitle;
}

export function OldSessionSongs({
  songUuids,
  songTitle,
}: OldSessionSongsProps) {
  const styles = useStyles();
  const titles = songUuids.flatMap((uuid) => {
    const title = songTitle(uuid);
    return title === undefined ? [] : [title];
  });
  const missing = songUuids.length - titles.length;
  return (
    <View style={styles.list}>
      {titles.map((title, index) => (
        <View key={`${title}-${String(index)}`} style={styles.row}>
          <EllipsizedText style={styles.title}>{title}</EllipsizedText>
        </View>
      ))}
      {missing === 0 ? null : (
        <View style={styles.row}>
          <EllipsizedText style={styles.gone}>
            {missingSongsText(missing)}
          </EllipsizedText>
        </View>
      )}
    </View>
  );
}
