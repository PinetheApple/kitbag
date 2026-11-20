import {
  asPercent,
  Button,
  createThemedStyles,
  dataFolder,
  dataFolderType,
  Icon,
  rowLabel,
  RowIcon,
  size,
  space,
  textRoles,
  textStyle,
  type IconName,
} from '@kitbag/core-design';
import {
  offeredCards,
  returnSourceMissing,
  useDataFolder,
  useSongLibrary,
  type DataFolderStore,
  type LibraryView,
} from '@kitbag/core-state';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { MOVE, PERCENT } from '../settings/dataFolderText.ts';
import { libraryStrip } from './libraryStrip.ts';
import { unavailableCount } from './libraryStripCount.ts';

const FIX = 'Fix';

const firstOffered = (state: DataFolderStore) => offeredCards(state)[0] ?? null;

const useStyles = createThemedStyles((theme) => ({
  strip: {
    backgroundColor: theme.color.surface1,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
    paddingTop: dataFolder.stripTop,
    paddingBottom: dataFolder.stripBottom,
    paddingLeft: space.screenInset,
    paddingRight: dataFolder.stripEnd,
  },
  pressed: { backgroundColor: theme.color.surface2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
  text: { flex: 1, minWidth: 0 },
  title: { ...textStyle(dataFolderType.stripTitle), color: theme.color.text },
  detail: {
    ...textStyle(textRoles.rowSubtitle),
    color: theme.color.text2,
  },
  fix: { marginRight: dataFolder.stripFixEnd },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: dataFolder.stripProgressBottom,
    height: dataFolder.stripProgress,
    backgroundColor: theme.color.line,
  },
  fill: { height: '100%', backgroundColor: theme.color.accent },
}));

interface StripBodyProps {
  readonly icon: IconName;
  readonly bad: boolean;
  readonly title: string;
  readonly detail: string | null;
  readonly trailing: ReactNode;
}

function StripBody({ icon, bad, title, detail, trailing }: StripBodyProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <RowIcon icon={icon} color={bad ? 'redInk' : 'text'} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail === null ? null : <Text style={styles.detail}>{detail}</Text>}
      </View>
      {trailing}
    </View>
  );
}

function ProgressLine({ percent }: { readonly percent: number }) {
  const styles = useStyles();
  const filled = useMemo(
    () => ({ width: asPercent(percent / PERCENT) }),
    [percent],
  );
  return (
    <View style={styles.track}>
      <View style={[styles.fill, filled]} />
    </View>
  );
}

export interface LibraryFolderStripProps {
  readonly view: LibraryView;
  readonly onOpenDataFolder: () => void;
  readonly onFix: () => void;
  readonly onOfferReturn: (volumeUuid: string) => void;
}

function StripButton({
  label,
  title,
  onPress,
}: {
  readonly label: string;
  readonly title: string;
  readonly onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.fix}>
      <Button
        variant="tonal"
        size="small"
        label={label}
        accessibilityLabel={`${label}: ${title}`}
        onPress={onPress}
      />
    </View>
  );
}

export function LibraryFolderStrip({
  view,
  onOpenDataFolder,
  onFix,
  onOfferReturn,
}: LibraryFolderStripProps) {
  const styles = useStyles();
  const move = useDataFolder((s) => s.move);
  const volumes = useDataFolder((s) => s.volumes);
  const offered = useDataFolder(firstOffered);
  const sourceMissing = useDataFolder(returnSourceMissing);
  const unavailable = useSongLibrary((s) =>
    unavailableCount(s.rows, s.rowFiles, view),
  );
  const strip = libraryStrip({
    move,
    volumes,
    unavailable,
    view,
    offered,
    sourceMissing,
  });
  const returnedCard = strip.kind === 'returned' ? strip.volumeUuid : null;
  const offerReturn = useCallback(() => {
    if (returnedCard !== null) onOfferReturn(returnedCard);
  }, [onOfferReturn, returnedCard]);
  const pressable = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.strip,
      pressed && styles.pressed,
    ],
    [styles],
  );
  if (strip.kind === 'none') return null;
  if (strip.kind === 'missing' || strip.kind === 'returned') {
    const missing = strip.kind === 'missing';
    return (
      <View accessibilityLiveRegion="polite" style={styles.strip}>
        <StripBody
          icon="sdCard"
          bad={missing}
          title={strip.title}
          detail={strip.detail}
          trailing={
            <StripButton
              label={missing ? FIX : MOVE}
              title={strip.title}
              onPress={missing ? onFix : offerReturn}
            />
          }
        />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rowLabel(strip.title, strip.detail)}
      {...(strip.percent === null
        ? {}
        : {
            accessibilityValue: { min: 0, max: PERCENT, now: strip.percent },
          })}
      style={pressable}
      onPress={onOpenDataFolder}
    >
      <StripBody
        icon="moveFolder"
        bad={false}
        title={strip.title}
        detail={strip.detail}
        trailing={<Icon name="forward" size="control" color="decor" />}
      />
      {strip.percent === null ? null : <ProgressLine percent={strip.percent} />}
    </Pressable>
  );
}
