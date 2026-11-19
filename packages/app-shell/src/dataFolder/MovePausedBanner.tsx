import {
  Card,
  createThemedStyles,
  rowLineHeight,
  RowIcon,
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

import { ChoiceButtons } from '../settings/ChoiceButtons.tsx';
import { moveErrorText, pausedHint } from '../settings/dataFolderMoveText.ts';
import { pausedTitle, RESUME, UNDO } from '../settings/dataFolderText.ts';

const useStyles = createThemedStyles((theme) => ({
  body: { gap: space.sectionGap },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.rowGap },
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
          <RowIcon
            icon="moveFolder"
            color={theme.accentInk}
            border="accentDim"
          />
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
          choices={[
            {
              key: UNDO,
              label: UNDO,
              primary: false,
              disabled: pending,
              onPress: undo,
            },
            {
              key: RESUME,
              label: RESUME,
              primary: true,
              disabled: pending,
              onPress: resume,
            },
          ]}
        />
      </View>
    </Card>
  );
}
