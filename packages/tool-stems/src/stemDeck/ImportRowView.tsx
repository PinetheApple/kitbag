import {
  Badge,
  EllipsizedText,
  Icon,
  LinearProgress,
  useTheme,
  type ColorToken,
} from '@kitbag/core-design';
import type { StemDeckImportRow } from '@kitbag/core-state';
import { Text, View } from 'react-native';

import {
  percentText,
  rowBadge,
  rowDetail,
  rowTile,
  type TileInk,
} from './logic/progressText.ts';
import { useStemDeckStyles } from './stemDeckStyles.ts';

function useInk(ink: TileInk): ColorToken {
  const theme = useTheme();
  return ink === 'accent' ? theme.accentInk : ink;
}

function Trailing({ row }: { readonly row: StemDeckImportRow }) {
  const styles = useStemDeckStyles();
  const badge = rowBadge(row);
  if (row.phase === 'downloading' && row.percent !== null)
    return <Text style={styles.percent}>{percentText(row.percent)}</Text>;
  if (badge === null) return null;
  return (
    <Badge
      variant="list"
      tone={badge.tone}
      label={badge.label}
      {...(badge.icon === undefined ? {} : { icon: badge.icon })}
    />
  );
}

function Progress({ row }: { readonly row: StemDeckImportRow }) {
  if (row.phase === 'downloading')
    return (
      <LinearProgress
        percent={row.percent}
        accessibilityLabel={`${row.title} download`}
      />
    );
  if (row.phase === 'preparing')
    return (
      <LinearProgress
        percent={null}
        accessibilityLabel={`${row.title} being prepared`}
      />
    );
  return null;
}

export interface ImportRowViewProps {
  readonly row: StemDeckImportRow;
  readonly stems: number | null;
}

export function ImportRowView({ row, stems }: ImportRowViewProps) {
  const styles = useStemDeckStyles();
  const tile = rowTile(row);
  const ink = useInk(tile.ink);
  return (
    <View style={[styles.row, styles.rowFull]}>
      <View style={styles.tile}>
        <Icon name={tile.icon} size="listTile" color={ink} />
      </View>
      <View style={styles.text}>
        <EllipsizedText style={styles.title}>{row.title}</EllipsizedText>
        <Text style={styles.facts}>{rowDetail(row, stems)}</Text>
        <Progress row={row} />
      </View>
      <View style={styles.trailing}>
        <Trailing row={row} />
      </View>
    </View>
  );
}
