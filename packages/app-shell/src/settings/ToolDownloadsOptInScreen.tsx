import {
  Button,
  createThemedStyles,
  Icon,
  space,
  textRoles,
  textStyle,
  toolsManager,
  toolsManagerText,
  bodyLineHeight,
  lineRatio,
  useTheme,
} from '@kitbag/core-design';
import { useToolInstall } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { SettingsFrame } from './SettingsFrame.tsx';
import {
  NOT_NOW,
  OPT_IN_HEADLINE,
  OPT_IN_HINT,
  OPT_IN_INTRO,
  OPT_IN_POINTS,
  TOOL_DOWNLOADS_TITLE,
  TURN_ON_DOWNLOADS,
  type OptInPoint,
} from './toolDownloadsText.ts';
import { useToolScreenStyles } from './toolScreenStyles.ts';

const useStyles = createThemedStyles((theme) => ({
  headline: {
    ...textStyle(toolsManagerText.headline),
    lineHeight: toolsManagerText.headline.size * lineRatio.title,
    color: theme.color.text,
    paddingHorizontal: toolsManager.introH,
  },
  points: { gap: space.sectionGap },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space.rowGap },
  pointIcon: { marginTop: toolsManager.pointIconTop },
  pointText: {
    ...textStyle(textRoles.fieldLabel),
    lineHeight: textRoles.fieldLabel.size * bodyLineHeight,
    color: theme.color.text,
    flex: 1,
  },
}));

function Point({ point }: { readonly point: OptInPoint }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Icon name={point.icon} size="title" color={theme.accentInk} />
      </View>
      <Text style={styles.pointText}>{point.text}</Text>
    </View>
  );
}

export interface ToolDownloadsOptInScreenProps {
  readonly toolId?: string | undefined;
  readonly onBack: () => void;
}

export function ToolDownloadsOptInScreen({
  toolId,
  onBack,
}: ToolDownloadsOptInScreenProps) {
  const styles = useStyles();
  const shared = useToolScreenStyles();
  const turnOn = useToolInstall((s) => s.turnOnFromOptIn);
  const handleTurnOn = useCallback(() => {
    void turnOn(toolId).then(onBack, () => undefined);
  }, [turnOn, toolId, onBack]);
  const dock = (
    <View style={shared.dock}>
      <Button
        size="sheet"
        variant="primary"
        label={TURN_ON_DOWNLOADS}
        onPress={handleTurnOn}
      />
      <Button size="sheet" variant="ghost" label={NOT_NOW} onPress={onBack} />
    </View>
  );
  return (
    <SettingsFrame title={TOOL_DOWNLOADS_TITLE} onBack={onBack} overlay={dock}>
      <Text accessibilityRole="header" style={styles.headline}>
        {OPT_IN_HEADLINE}
      </Text>
      <Text style={shared.body}>{OPT_IN_INTRO}</Text>
      <View style={styles.points}>
        {OPT_IN_POINTS.map((point) => (
          <Point key={point.icon} point={point} />
        ))}
      </View>
      <Text style={shared.hint}>{OPT_IN_HINT}</Text>
    </SettingsFrame>
  );
}
