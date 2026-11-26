import {
  Button,
  Card,
  createThemedStyles,
  Icon,
  libraryList,
  lineRatio,
  rowLineHeight,
  space,
  textRoles,
  textStyle,
  useTheme,
  type IconName,
} from '@kitbag/core-design';
import { ScrollView, Text, View } from 'react-native';

interface AccessPromise {
  readonly kept: boolean;
  readonly text: string;
}

const PROMISES: readonly AccessPromise[] = [
  {
    kept: true,
    text: 'Reads the title, artist and position of what’s playing',
  },
  { kept: true, text: 'Plays, pauses and skips in that app for you' },
  { kept: false, text: 'Never reads your messages or other notifications' },
  { kept: false, text: 'Never records or listens to any audio' },
];

const KEPT_ICON: IconName = 'check';
const NEVER_ICON: IconName = 'close';

const useStyles = createThemedStyles((theme) => ({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: space.sectionGap,
    paddingVertical: space.sectionGap,
    paddingHorizontal: space.screenInset,
  },
  head: { alignItems: 'center', gap: libraryList.emptyGap },
  mark: {
    width: libraryList.emptyMark,
    height: libraryList.emptyMark,
    borderRadius: libraryList.emptyMarkRadius,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...textStyle(textRoles.listEmptyTitle),
    color: theme.color.text,
    textAlign: 'center',
  },
  body: {
    ...textStyle(textRoles.listEmptyReason),
    lineHeight: textRoles.listEmptyReason.size * lineRatio.compactBody,
    color: theme.color.text2,
    textAlign: 'center',
  },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
    minHeight: libraryList.emptyButtonHeight,
  },
  promiseText: {
    ...textStyle(textRoles.menuRow),
    color: theme.color.text,
    flexShrink: 1,
  },
  warningTitle: {
    ...textStyle(textRoles.rowTitle),
    lineHeight: rowLineHeight.title,
    color: theme.color.text,
  },
  warningBody: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color.text2,
  },
  buttons: { gap: space.controlGap },
  hint: {
    ...textStyle(textRoles.hint),
    lineHeight: textRoles.hint.size * lineRatio.hint,
    color: theme.color.text3,
    textAlign: 'center',
  },
}));

function StillOffCard() {
  const styles = useStyles();
  return (
    <Card emphasis="warning" statusIcon="warning" statusLabel="Warning">
      <Text style={styles.warningTitle}>Notification access is still off</Text>
      <Text style={styles.warningBody}>
        Kitbag is not turned on in the list yet.
      </Text>
    </Card>
  );
}

function Promises() {
  const styles = useStyles();
  return (
    <Card>
      {PROMISES.map(({ kept, text }) => (
        <View key={text} style={styles.promise}>
          <Icon
            name={kept ? KEPT_ICON : NEVER_ICON}
            size="action"
            color={kept ? 'green' : 'text2'}
            accessibilityLabel={kept ? 'Does' : 'Never'}
          />
          <Text style={styles.promiseText}>{text}</Text>
        </View>
      ))}
    </Card>
  );
}

export interface PermissionExplainerProps {
  readonly stillOff: boolean;
  readonly onOpenAccess: () => void;
  readonly onNotNow: () => void;
}

export function PermissionExplainer({
  stillOff,
  onOpenAccess,
  onNotNow,
}: PermissionExplainerProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content} persistentScrollbar>
      <View style={styles.head}>
        <View style={styles.mark}>
          <Icon name="playAlong" size="emptyMark" color={theme.accentInk} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          See what’s playing
        </Text>
        {stillOff ? null : (
          <Text style={styles.body}>
            To follow Spotify and other music apps, Kitbag needs Android’s
            notification access.
          </Text>
        )}
      </View>
      {stillOff ? <StillOffCard /> : null}
      <Promises />
      <View style={styles.buttons}>
        <Button
          variant="primary"
          size="target"
          label="Open notification access"
          onPress={onOpenAccess}
        />
        <Button
          variant="ghost"
          size="target"
          label="Not now, use tap tempo"
          onPress={onNotNow}
        />
      </View>
      <Text style={styles.hint}>
        Find Kitbag in the list, turn it on, then come back.
      </Text>
    </ScrollView>
  );
}
