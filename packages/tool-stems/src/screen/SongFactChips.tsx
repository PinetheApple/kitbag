import {
  createThemedStyles,
  size,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { Text, View } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: stemPlayer.factGap,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.factValueGap,
    minHeight: stemPlayer.factChipHeight,
    paddingHorizontal: stemPlayer.factChipH,
    borderRadius: stemPlayer.factChipRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  value: { ...textStyle(textRoles.factChip), color: theme.color.text },
  unsure: { color: theme.color.text3 },
  unit: {
    ...textStyle(textRoles.factUnit),
    color: theme.color.text3,
    marginLeft: stemPlayer.factUnitLead,
  },
  quiet: {
    ...textStyle(textRoles.factQuiet),
    color: theme.color.text3,
    marginLeft: stemPlayer.factQuietLead,
  },
}));

export function SongFactChips() {
  const styles = useStyles();
  const { bpm, key, tempo } = useStemPlayer((s) => s.facts);
  if (bpm === null && key === null && tempo === null) return null;
  return (
    <View style={styles.row}>
      {bpm === null ? null : (
        <View accessible accessibilityLabel={bpm.spoken} style={styles.chip}>
          <Text style={styles.value}>{bpm.value}</Text>
          <Text style={styles.unit}>{bpm.unit}</Text>
        </View>
      )}
      {key === null ? null : (
        <View accessible accessibilityLabel={key.spoken} style={styles.chip}>
          <Text style={[styles.value, key.muted && styles.unsure]}>
            {key.text}
          </Text>
        </View>
      )}
      {tempo === null ? null : <Text style={styles.quiet}>{tempo.text}</Text>}
    </View>
  );
}
