import {
  Card,
  createThemedStyles,
  Icon,
  radius,
  rowLineHeight,
  size,
  space,
  textRoles,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import {
  pausedMove,
  useDataFolder,
  type DataFolderStore,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { moveErrorText, pausedHint } from '../settings/dataFolderMoveText.ts';
import { pausedTitle, RESUME, UNDO } from '../settings/dataFolderText.ts';
import { ChoiceButtons } from './ChoiceButtons.tsx';

const useStyles = createThemedStyles((theme) => ({
  body: { gap: space.sectionGap },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.rowGap },
  icon: {
    width: size.toolIcon,
    height: size.toolIcon,
    borderRadius: radius.toolIcon,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    ...textStyle(textRoles.rowTitle),
    lineHeight: rowLineHeight.title,
    color: theme.color.text,
  },
  hint: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color.text2,
  },
}));

function refusalText(state: DataFolderStore): string | null {
  const { error, codes, move } = state;
  if (error === null || codes === null) return null;
  const places = {
    source: move?.sourceVolumeUuid ?? null,
    target: move?.targetVolumeUuid ?? null,
  };
  return moveErrorText(error, codes, places).body;
}

export function MovePausedBanner() {
  const styles = useStyles();
  const theme = useTheme();
  const paused = useDataFolder(pausedMove);
  const codes = useDataFolder((s) => s.codes);
  const pending = useDataFolder((s) => s.pending);
  const resumeMove = useDataFolder((s) => s.resumeMove);
  const undoMove = useDataFolder((s) => s.undoMove);
  const refusal = useDataFolder(refusalText);
  const resume = useCallback(() => {
    void resumeMove();
  }, [resumeMove]);
  const undo = useCallback(() => {
    void undoMove();
  }, [undoMove]);
  if (paused === null || codes === null) return null;
  return (
    <Card emphasis="activeGroup">
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon name="moveFolder" size="tile" color={theme.accentInk} />
          </View>
          <View style={styles.text}>
            <Text accessibilityRole="header" style={styles.title}>
              {pausedTitle(paused)}
            </Text>
            <Text style={styles.hint}>
              {pausedHint(paused, codes.movePhases)}
            </Text>
            {refusal === null ? null : (
              <Text accessibilityLiveRegion="polite" style={styles.hint}>
                {refusal}
              </Text>
            )}
          </View>
        </View>
        <ChoiceButtons
          secondary={{ label: UNDO, disabled: pending, onPress: undo }}
          primary={{ label: RESUME, disabled: pending, onPress: resume }}
        />
      </View>
    </Card>
  );
}
