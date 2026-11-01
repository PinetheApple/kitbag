import {
  bodyLineHeight,
  createThemedStyles,
  ListSwitchRow,
  radii,
  size,
  textStyle,
  toolsManager,
  toolsManagerText,
} from '@kitbag/core-design';
import { useTools } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { BUILT_TOOLS, type BuiltTool } from '../home/registry.ts';
import { useToolOn } from '../home/toolsOn.ts';
import { SettingsFrame } from './SettingsFrame.tsx';
import {
  TOOLS_INTRO,
  TOOLS_NOTE,
  TOOLS_TITLE,
  toolSwitchStep,
} from './toolsText.ts';

const useStyles = createThemedStyles((theme) => {
  const small = {
    ...textStyle(toolsManagerText.small),
    lineHeight: toolsManagerText.small.size * bodyLineHeight,
    color: theme.color.text2,
  };
  return {
    intro: { ...small, paddingHorizontal: toolsManager.introH },
    spacer: { flex: 1 },
    note: {
      paddingVertical: toolsManager.noteV,
      paddingHorizontal: toolsManager.noteH,
      borderRadius: radii.card,
      borderWidth: size.stroke,
      borderColor: theme.color.line,
      backgroundColor: theme.color.surface1,
    },
    noteText: small,
  };
});

interface ToolSwitchProps {
  readonly tool: BuiltTool;
  readonly on: boolean;
  readonly onSwitch: (toolId: string, on: boolean) => void;
}

function ToolSwitch({ tool, on, onSwitch }: ToolSwitchProps) {
  const handleChange = useCallback(
    (value: boolean) => {
      onSwitch(tool.id, value);
    },
    [onSwitch, tool.id],
  );
  return (
    <ListSwitchRow
      icon={tool.icon}
      title={tool.name}
      subtitle={tool.summary}
      value={on}
      onValueChange={handleChange}
    />
  );
}

export function ToolsScreen({ onBack }: { readonly onBack: () => void }) {
  const styles = useStyles();
  const off = useTools((s) => s.off);
  const setOff = useTools((s) => s.setOff);
  const isOn = useToolOn();
  const [note, setNote] = useState(TOOLS_NOTE);
  const handleSwitch = useCallback(
    (toolId: string, on: boolean) => {
      const step = toolSwitchStep(off, toolId, on);
      setNote(step.note);
      setOff(step.off);
    },
    [off, setOff],
  );
  return (
    <SettingsFrame title={TOOLS_TITLE} onBack={onBack} fill>
      <Text style={styles.intro}>{TOOLS_INTRO}</Text>
      {BUILT_TOOLS.map((tool) => (
        <ToolSwitch
          key={tool.id}
          tool={tool}
          on={isOn(tool.id)}
          onSwitch={handleSwitch}
        />
      ))}
      <View style={styles.spacer} />
      <View style={styles.note}>
        <Text accessibilityLiveRegion="polite" style={styles.noteText}>
          {note}
        </Text>
      </View>
    </SettingsFrame>
  );
}
