import {
  Badge,
  createThemedStyles,
  EllipsizedText,
  hitBoxStyle,
  hitExtension,
  listEdges,
  Icon,
  type IconName,
  isTextScaled,
  libraryList,
  libraryMix,
  lineRatio,
  minTouchTargetDp,
  opacity,
  size,
  space,
  textIconScale,
  textRoles,
  textStyle,
  unshared,
  useTheme,
  withAlpha,
} from '@kitbag/core-design';
import {
  rowTap,
  songBadge,
  useLiveSongPlayer,
  useLiveStemPlayer,
  type LibraryRow,
  type RowTap,
  type SongBadge,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { failureText } from '../logic/notices.ts';
import { rowLayout } from '../logic/rowLayout.ts';
import {
  nowPlayingSubtitle,
  rowBadges,
  rowSubtitle,
  showsGridIcon,
  spokenRow,
  type NowPlaying,
  type RowPlace,
} from '../logic/rowText.ts';
import { useIsCurrentRow, useShownPlaying } from './nowPlaying.ts';
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
    paddingBottom: size.stroke,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    height: size.stroke,
    backgroundColor: theme.color.line,
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
  playingTitle: { color: theme.color[theme.accentInk] },
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

const TILE_ICON: Record<NowPlaying, IconName> = {
  playing: 'pause',
  paused: 'play',
};

function tileIcon(stems: boolean, playState: NowPlaying | null): IconName {
  if (stems) return 'stems';
  return playState === null ? 'song' : TILE_ICON[playState];
}

function RowTile({
  stems,
  muted,
  playState,
}: {
  readonly stems: boolean;
  readonly muted: boolean;
  readonly playState: NowPlaying | null;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View
      style={[styles.tile, stems && styles.stemTile, muted && styles.muted]}
    >
      <Icon
        name={tileIcon(stems, playState)}
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
  readonly onOpenStemSet: (id: number, tap: RowTap) => void;
  readonly onOpenSong: (id: number, tap: RowTap) => void;
  readonly onUnavailable: (row: LibraryRow) => void;
}

function useRowTap(row: LibraryRow): RowTap {
  const songStatus = useLiveSongPlayer((s) => s.status);
  const songId = useLiveSongPlayer((s) => s.songId);
  const stemStatus = useLiveStemPlayer((s) => s.status);
  const setId = useLiveStemPlayer((s) => s.setId);
  return rowTap(row, {
    song: { status: songStatus, songId },
    stems: { status: stemStatus, setId },
  });
}

function useRowPlace(row: LibraryRow, moving: boolean): RowPlace {
  const files = useRowFiles(row);
  if (files === 'unavailable') return 'unavailable';
  return moving ? 'moving' : 'here';
}

export function LibraryRowView(props: LibraryRowViewProps) {
  const current = useIsCurrentRow(props.row);
  return current ? (
    <CurrentRow {...props} />
  ) : (
    <RowView {...props} playState={null} />
  );
}

function CurrentRow(props: LibraryRowViewProps) {
  const playing = useShownPlaying(props.row.kind);
  return <RowView {...props} playState={playing ? 'playing' : 'paused'} />;
}

function RowView({
  row,
  selected,
  moving,
  playState,
  onActions,
  onOpenStemSet,
  onOpenSong,
  onUnavailable,
}: LibraryRowViewProps & { readonly playState: NowPlaying | null }) {
  const styles = useStyles();
  const { fontScale, width } = useWindowDimensions();
  const { dividerInset } = listEdges(width);
  const divider = useMemo(
    () => [styles.divider, { left: dividerInset, right: dividerInset }],
    [styles.divider, dividerInset],
  );
  const { titleLines, factsLines, badgesUnderText } = rowLayout(fontScale);
  const status = rowStatus(row);
  const failure = useRowFailure(row);
  const place = useRowPlace(row, moving);
  const away = place === 'unavailable';
  const tap = useRowTap(row);
  const openActions = useCallback(() => {
    onActions(row);
  }, [onActions, row]);
  const open = useCallback(() => {
    if (away) {
      onUnavailable(row);
      return;
    }
    if (row.kind === 'stems') onOpenStemSet(row.id, tap);
    else onOpenSong(row.id, tap);
  }, [away, tap, onUnavailable, onOpenStemSet, onOpenSong, row]);
  const shownBadges = rowBadges(row, status, place);
  const gridIcon = showsGridIcon(row, place);
  const badges =
    shownBadges.length > 0 || gridIcon ? (
      <View style={[styles.badges, badgesUnderText && styles.badgesUnderText]}>
        {shownBadges.map((badge) => (
          <Badge
            key={badge.key}
            variant="list"
            label={badge.label}
            tone={badge.tone}
            {...(badge.icon === undefined ? {} : { icon: badge.icon })}
            accessibilityLabel={badge.spoken}
          />
        ))}
        {gridIcon && (
          <Icon
            name="beatGrid"
            size="listBadge"
            color="greenInk"
            scale={textIconScale(fontScale)}
          />
        )}
      </View>
    ) : null;
  return (
    <View style={[styles.row, selected && styles.selected]}>
      <View pointerEvents="none" style={divider} />
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
        <RowTile
          stems={row.kind === 'stems'}
          muted={away}
          playState={playState}
        />
        <View style={styles.text}>
          <EllipsizedText
            style={[
              styles.title,
              playState !== null && styles.playingTitle,
              away && styles.muted,
            ]}
            numberOfLines={titleLines}
          >
            {row.title}
          </EllipsizedText>
          <EllipsizedText style={styles.facts} numberOfLines={factsLines}>
            {playState === null
              ? rowSubtitle(row, status, failure)
              : nowPlayingSubtitle(
                  row,
                  rowSubtitle(row, status, failure),
                  playState,
                )}
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
