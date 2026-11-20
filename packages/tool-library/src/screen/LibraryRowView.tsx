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
  opacity,
  size,
  space,
  textRoles,
  textStyle,
  unshared,
  useTheme,
  withAlpha,
} from '@kitbag/core-design';
import {
  songBadge,
  useLibrary,
  useStemPlayer,
  type LibraryRow,
  type SongBadge,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { failureText } from '../logic/notices.ts';
import { rowLayout } from '../logic/rowLayout.ts';
import {
  rowBadges,
  rowSubtitle,
  spokenRow,
  type RowPlace,
} from '../logic/rowText.ts';
import { useRowFailure, useRowFiles } from './rowFailureHooks.ts';

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
  muted: { opacity: opacity.muted },
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

function RowTile({
  stems,
  muted,
}: {
  readonly stems: boolean;
  readonly muted: boolean;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View
      style={[styles.tile, stems && styles.stemTile, muted && styles.muted]}
    >
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
  readonly moving: boolean;
  readonly onActions: (row: LibraryRow) => void;
  readonly onOpenStemSet: (id: number) => void;
  readonly onOpenSong: (id: number) => void;
  readonly onUnavailable: (row: LibraryRow) => void;
}

function useRowPlace(row: LibraryRow, moving: boolean): RowPlace {
  const files = useRowFiles(row);
  if (files === 'unavailable') return 'unavailable';
  return moving ? 'moving' : 'here';
}

export function LibraryRowView({
  row,
  selected,
  moving,
  onActions,
  onOpenStemSet,
  onOpenSong,
  onUnavailable,
}: LibraryRowViewProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const { titleLines, factsLines, badgesUnderText } = rowLayout(fontScale);
  const status = rowStatus(row);
  const failure = useRowFailure(row);
  const place = useRowPlace(row, moving);
  const away = place === 'unavailable';
  const endSetlistSession = useLibrary((s) => s.endSetlistSession);
  const openStemSetId = useStemPlayer((s) =>
    s.status === 'ready' ? s.setId : null,
  );
  const openActions = useCallback(() => {
    onActions(row);
  }, [onActions, row]);
  const open = useCallback(() => {
    if (away) {
      onUnavailable(row);
      return;
    }
    const reopens = row.kind === 'stems' && row.id === openStemSetId;
    endSetlistSession(reopens ? row.id : undefined);
    if (row.kind === 'stems') onOpenStemSet(row.id);
    else onOpenSong(row.id);
  }, [
    away,
    endSetlistSession,
    openStemSetId,
    onUnavailable,
    onOpenStemSet,
    onOpenSong,
    row,
  ]);
  const badges = (
    <View style={[styles.badges, badgesUnderText && styles.badgesUnderText]}>
      {rowBadges(row, status, place).map((badge) => (
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
        accessibilityRole="button"
        accessibilityLabel={spokenRow(
          row,
          status,
          failure === null ? null : failureText(failure).status,
          place,
        )}
        style={[styles.body, isTextScaled(fontScale) && styles.scaledBody]}
        onLongPress={openActions}
        onPress={open}
      >
        <RowTile stems={row.kind === 'stems'} muted={away} />
        <View style={styles.text}>
          <EllipsizedText
            style={[styles.title, away && styles.muted]}
            numberOfLines={titleLines}
          >
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
