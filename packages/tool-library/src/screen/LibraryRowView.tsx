import {
  Badge,
  createThemedStyles,
  EllipsizedText,
  hitBoxStyle,
  hitExtension,
  Icon,
  isTextScaled,
  libraryList,
  libraryMix,
  lineRatio,
  minTouchTargetDp,
  size,
  space,
  textRoles,
  textStyle,
  unshared,
  useTheme,
  withAlpha,
} from '@kitbag/core-design';
import {
  analysisFailure,
  songBadge,
  useSongLibrary,
  type LibraryRow,
  type SongBadge,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { failureText } from '../logic/notices.ts';
import { rowLayout } from '../logic/rowLayout.ts';
import { rowBadges, rowSubtitle, spokenRow } from '../logic/rowText.ts';

const MORE_HIT_BOX = hitBoxStyle(
  hitExtension(libraryList.moreWidth, minTouchTargetDp, {
    left: libraryList.rowGap,
    right: unshared(libraryList.rowEnd),
  }),
);

const useStyles = createThemedStyles((theme) => ({
  row: {
    minHeight: libraryList.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
    paddingLeft: space.screenInset,
    paddingRight: libraryList.rowEnd,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  selected: {
    backgroundColor: withAlpha(theme.color.text, libraryMix.selectedRow),
  },
  body: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
  },
  scaledBody: {
    paddingVertical: (libraryList.rowHeight - libraryList.tile) / 2,
  },
  tile: {
    width: libraryList.tile,
    height: libraryList.tile,
    borderRadius: libraryList.tileRadius,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stemTile: {
    backgroundColor: theme.stemTileFill,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    ...textStyle(textRoles.listTitle),
    lineHeight: textRoles.listTitle.size * lineRatio.title,
    color: theme.color.text,
  },
  facts: {
    ...textStyle(textRoles.listFacts),
    lineHeight: textRoles.listFacts.size * lineRatio.compactBody,
    color: theme.color.text2,
  },
  badges: {
    alignItems: 'flex-end',
    gap: libraryList.badgeGap,
    flexShrink: 0,
  },
  badgesUnderText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginTop: libraryList.badgeGap,
  },
  more: {
    ...MORE_HIT_BOX,
    width: libraryList.moreWidth,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

function rowStatus(row: LibraryRow): SongBadge {
  if (row.kind === 'song') return songBadge(row);
  return row.hasGrid ? 'grid' : 'noGrid';
}

function RowTile({ stems }: { readonly stems: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={[styles.tile, stems && styles.stemTile]}>
      <Icon
        name={stems ? 'stems' : 'song'}
        size="listTile"
        color={stems ? theme.accentInk : 'text2'}
      />
    </View>
  );
}

export interface LibraryRowViewProps {
  readonly row: LibraryRow;
  readonly selected: boolean;
  readonly onActions: (row: LibraryRow) => void;
  readonly onOpenStemSet: (id: number) => void;
}

export function LibraryRowView({
  row,
  selected,
  onActions,
  onOpenStemSet,
}: LibraryRowViewProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const { titleLines, factsLines, badgesUnderText } = rowLayout(fontScale);
  const codes = useSongLibrary((s) => s.codes);
  const status = rowStatus(row);
  const failure = row.kind === 'song' ? analysisFailure(row, codes) : null;
  const openActions = useCallback(() => {
    onActions(row);
  }, [onActions, row]);
  const open = useCallback(() => {
    onOpenStemSet(row.id);
  }, [onOpenStemSet, row.id]);
  const badges = (
    <View style={[styles.badges, badgesUnderText && styles.badgesUnderText]}>
      {rowBadges(row, status).map((badge) => (
        <Badge
          key={badge.key}
          variant="list"
          label={badge.label}
          tone={badge.tone}
          {...(badge.icon === undefined ? {} : { icon: badge.icon })}
          accessibilityLabel={badge.spoken}
        />
      ))}
    </View>
  );
  return (
    <View style={[styles.row, selected && styles.selected]}>
      <Pressable
        accessible
        accessibilityLabel={spokenRow(
          row,
          status,
          failure === null ? null : failureText(failure).status,
        )}
        style={[styles.body, isTextScaled(fontScale) && styles.scaledBody]}
        onLongPress={openActions}
        {...(row.kind === 'stems'
          ? { accessibilityRole: 'button' as const, onPress: open }
          : {})}
      >
        <RowTile stems={row.kind === 'stems'} />
        <View style={styles.text}>
          <EllipsizedText style={styles.title} numberOfLines={titleLines}>
            {row.title}
          </EllipsizedText>
          <EllipsizedText style={styles.facts} numberOfLines={factsLines}>
            {rowSubtitle(row, status, failure)}
          </EllipsizedText>
          {badgesUnderText && badges}
        </View>
        {!badgesUnderText && badges}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${row.title}`}
        style={styles.more}
        onPress={openActions}
      >
        <Icon name="more" size="bar" color="text2" />
      </Pressable>
    </View>
  );
}
