import {
  asPercent,
  Button,
  createThemedStyles,
  dataFolder,
  dataFolderType,
  Icon,
  miniPlayer,
  radius,
  rowLabel,
  size,
  space,
  textRoles,
  textStyle,
  type IconName,
} from '@kitbag/core-design';
import {
  useDataFolder,
  useSongLibrary,
  type LibraryView,
} from '@kitbag/core-state';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { libraryStrip } from './libraryStrip.ts';
import { unavailableCount } from './libraryStripCount.ts';

const PERCENT = 100;
const FIX = 'Fix';

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
  icon: {
    width: size.toolIcon,
    height: size.toolIcon,
    borderRadius: radius.toolIcon,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    bottom: miniPlayer.progressTop,
    height: miniPlayer.progress,
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
      <View style={styles.icon}>
        <Icon name={icon} size="tile" color={bad ? 'redInk' : 'text'} />
      </View>
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
}

export function LibraryFolderStrip({
  view,
  onOpenDataFolder,
  onFix,
}: LibraryFolderStripProps) {
  const styles = useStyles();
  const move = useDataFolder((s) => s.move);
  const volumes = useDataFolder((s) => s.volumes);
  const unavailable = useSongLibrary((s) =>
    unavailableCount(s.rows, s.rowFiles, view),
  );
  const strip = libraryStrip({ move, volumes, unavailable, view });
  const pressable = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.strip,
      pressed && styles.pressed,
    ],
    [styles],
  );
  if (strip.kind === 'none') return null;
  if (strip.kind === 'missing')
    return (
      <View accessibilityLiveRegion="polite" style={styles.strip}>
        <StripBody
          icon="sdCard"
          bad
          title={strip.title}
          detail={strip.detail}
          trailing={
            <View style={styles.fix}>
              <Button
                variant="tonal"
                size="small"
                label={FIX}
                accessibilityLabel={`${FIX}: ${strip.title}`}
                onPress={onFix}
              />
            </View>
          }
        />
      </View>
    );
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
