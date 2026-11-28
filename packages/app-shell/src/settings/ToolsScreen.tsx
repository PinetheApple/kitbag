import {
  bodyLineHeight,
  Button,
  createThemedStyles,
  EditGroup,
  EditRow,
  EditValue,
  ListRow,
  ListSwitchRow,
  radii,
  rowLabel,
  SectionHeader,
  Sheet,
  size,
  Snackbar,
  snackbar,
  Switch,
  textRoles,
  textStyle,
  toolsManager,
} from '@kitbag/core-design';
import { KB_TOOL_DOWNLOADS, type ToolCatalogueTool } from '@kitbag/core-native';
import {
  findTool,
  NO_TOOL_DATA,
  toolsOn,
  useToolCatalogue,
  useToolInstall,
  useTools,
  type ToolDataUsage,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BUILT_TOOL_IDS,
  BUILT_TOOLS,
  type BuiltTool,
} from '../home/registry.ts';
import { SettingsFrame } from './SettingsFrame.tsx';
import {
  CANCEL,
  DOWNLOADS_LABEL,
  downloadsHint,
  downloadsValue,
  TOOL_DOWNLOADS_TITLE,
  TURN_OFF,
  TURN_OFF_BODY,
  TURN_OFF_TITLE,
} from './toolDownloadsText.ts';
import { toolIcon } from './toolPageModel.ts';
import { useToolScreenStyles } from './toolScreenStyles.ts';
import {
  BUILT_IN_LABEL,
  DOWNLOADED_LABEL,
  DOWNLOADS_OFF_NOTE,
  downloadedSubtitle,
  removedNotice,
  TO_DOWNLOAD_LABEL,
  toDownloadSubtitle,
  toolName,
  TOOLS_INTRO,
  TOOLS_NOTE,
  TOOLS_TITLE,
  toolSwitchStep,
} from './toolsText.ts';

const useStyles = createThemedStyles((theme) => {
  const small = {
    ...textStyle(textRoles.fieldLabel),
    lineHeight: textRoles.fieldLabel.size * bodyLineHeight,
    color: theme.color.text2,
  };
  return {
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

function Note({
  text,
  live = false,
}: {
  readonly text: string;
  readonly live?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.note}>
      <Text
        accessibilityLiveRegion={live ? 'polite' : 'none'}
        style={styles.noteText}
      >
        {text}
      </Text>
    </View>
  );
}

type SwitchHandler = (toolId: string, on: boolean) => void;

function BuiltInSwitch({
  tool,
  on,
  onSwitch,
}: {
  readonly tool: BuiltTool;
  readonly on: boolean;
  readonly onSwitch: SwitchHandler;
}) {
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

function DownloadedRow({
  tool,
  on,
  onSwitch,
  onOpen,
}: {
  readonly tool: ToolCatalogueTool;
  readonly on: boolean;
  readonly onSwitch: SwitchHandler;
  readonly onOpen: (toolId: string) => void;
}) {
  const name = toolName(tool);
  const subtitle = downloadedSubtitle(tool);
  const handleChange = useCallback(
    (value: boolean) => {
      onSwitch(tool.toolId, value);
    },
    [onSwitch, tool.toolId],
  );
  const handleOpen = useCallback(() => {
    onOpen(tool.toolId);
  }, [onOpen, tool.toolId]);
  return (
    <ListRow
      icon={toolIcon(tool.icon)}
      title={name}
      subtitle={subtitle}
      accessibilityLabel={rowLabel(name, subtitle)}
      onPress={handleOpen}
      trailing={
        <Switch
          value={on}
          onValueChange={handleChange}
          accessibilityLabel={name}
        />
      }
    />
  );
}

function ToDownloadRow({
  tool,
  data,
  onOpen,
}: {
  readonly tool: ToolCatalogueTool;
  readonly data: ToolDataUsage;
  readonly onOpen: (toolId: string) => void;
}) {
  const name = toolName(tool);
  const subtitle = toDownloadSubtitle(tool, data);
  const handleOpen = useCallback(() => {
    onOpen(tool.toolId);
  }, [onOpen, tool.toolId]);
  return (
    <ListRow
      icon={toolIcon(tool.icon)}
      title={name}
      subtitle={subtitle}
      accessibilityLabel={rowLabel(name, subtitle)}
      onPress={handleOpen}
    />
  );
}

function DownloadsGroup({
  downloads,
  onPress,
}: {
  readonly downloads: KB_TOOL_DOWNLOADS;
  readonly onPress: () => void;
}) {
  const styles = useToolScreenStyles();
  const value = downloadsValue(downloads);
  return (
    <>
      <SectionHeader label={DOWNLOADS_LABEL} />
      <EditGroup>
        <EditRow
          label={TOOL_DOWNLOADS_TITLE}
          accessibilityLabel={rowLabel(TOOL_DOWNLOADS_TITLE, value)}
          onPress={onPress}
        >
          <EditValue>{value}</EditValue>
        </EditRow>
      </EditGroup>
      <Text style={styles.hint}>{downloadsHint(downloads)}</Text>
    </>
  );
}

function TurnOffSheet({
  visible,
  onConfirm,
  onCancel,
}: {
  readonly visible: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const styles = useToolScreenStyles();
  const insets = useSafeAreaInsets();
  return (
    <Sheet
      visible={visible}
      title={TURN_OFF_TITLE}
      dismissLabel={CANCEL}
      bottomInset={insets.bottom}
      onDismiss={onCancel}
    >
      <Text style={styles.body}>{TURN_OFF_BODY}</Text>
      <View style={styles.actions}>
        <Button fill size="sheet" label={CANCEL} onPress={onCancel} />
        <Button
          fill
          size="sheet"
          variant="primary"
          label={TURN_OFF}
          onPress={onConfirm}
        />
      </View>
    </Sheet>
  );
}

function useRemovedNotice(removedToolId: string | undefined) {
  const catalogue = useToolInstall((s) => s.catalogue);
  const data = useToolInstall((s) => s.data);
  const [notice, setNotice] = useState<string | null>(null);
  const shownFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (removedToolId === undefined || shownFor.current === removedToolId)
      return;
    const tool = findTool(catalogue, removedToolId);
    if (tool === undefined) return;
    shownFor.current = removedToolId;
    const kept = (data[removedToolId] ?? NO_TOOL_DATA).items > 0;
    setNotice(removedNotice(toolName(tool), kept));
  }, [removedToolId, catalogue, data]);
  const clear = useCallback(() => {
    setNotice(null);
  }, []);
  return { notice, clear };
}

export interface ToolsScreenProps {
  readonly onBack: () => void;
  readonly onOpenTool: (toolId: string) => void;
  readonly onOpenOptIn: () => void;
  readonly removedToolId?: string | undefined;
}

export function ToolsScreen({
  onBack,
  onOpenTool,
  onOpenOptIn,
  removedToolId,
}: ToolsScreenProps) {
  const styles = useToolScreenStyles();
  const insets = useSafeAreaInsets();
  const off = useTools((s) => s.off);
  const setOff = useTools((s) => s.setOff);
  const downloads = useToolInstall((s) => s.downloads);
  const data = useToolInstall((s) => s.data);
  const refresh = useToolInstall((s) => s.refresh);
  const turnOff = useToolInstall((s) => s.turnOff);
  const { sections, roster } = useToolCatalogue(BUILT_TOOL_IDS);
  const [note, setNote] = useState(TOOLS_NOTE);
  const [askingOff, setAskingOff] = useState(false);
  const removed = useRemovedNotice(removedToolId);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const onIds = useMemo(() => toolsOn(roster, off), [roster, off]);
  const handleSwitch = useCallback(
    (toolId: string, on: boolean) => {
      const step = toolSwitchStep(off, roster, toolId, on);
      setNote(step.note);
      setOff(step.off);
    },
    [off, roster, setOff],
  );
  const handleDownloads = useCallback(() => {
    if (downloads === KB_TOOL_DOWNLOADS.on) setAskingOff(true);
    else onOpenOptIn();
  }, [downloads, onOpenOptIn]);
  const cancelOff = useCallback(() => {
    setAskingOff(false);
  }, []);
  const confirmOff = useCallback(() => {
    setAskingOff(false);
    void turnOff();
  }, [turnOff]);
  const overlay =
    removed.notice === null ? null : (
      <Snackbar
        message={removed.notice}
        bottom={insets.bottom + snackbar.aboveSheet}
        onTimeout={removed.clear}
      />
    );
  return (
    <SettingsFrame title={TOOLS_TITLE} onBack={onBack} overlay={overlay}>
      <Text style={styles.body}>{TOOLS_INTRO}</Text>
      <Note text={note} live />
      <SectionHeader label={BUILT_IN_LABEL} />
      {BUILT_TOOLS.map((tool) => (
        <BuiltInSwitch
          key={tool.id}
          tool={tool}
          on={onIds.includes(tool.id)}
          onSwitch={handleSwitch}
        />
      ))}
      {sections.downloaded.length === 0 ? null : (
        <SectionHeader label={DOWNLOADED_LABEL} />
      )}
      {sections.downloaded.map((tool) => (
        <DownloadedRow
          key={tool.toolId}
          tool={tool}
          on={onIds.includes(tool.toolId)}
          onSwitch={handleSwitch}
          onOpen={onOpenTool}
        />
      ))}
      {sections.toDownload.length === 0 ? null : (
        <SectionHeader label={TO_DOWNLOAD_LABEL} />
      )}
      {sections.toDownload.length > 0 && downloads === KB_TOOL_DOWNLOADS.off ? (
        <Note text={DOWNLOADS_OFF_NOTE} />
      ) : null}
      {sections.toDownload.map((tool) => (
        <ToDownloadRow
          key={tool.toolId}
          tool={tool}
          data={data[tool.toolId] ?? NO_TOOL_DATA}
          onOpen={onOpenTool}
        />
      ))}
      {downloads === null || downloads === KB_TOOL_DOWNLOADS.unasked ? null : (
        <DownloadsGroup downloads={downloads} onPress={handleDownloads} />
      )}
      <TurnOffSheet
        visible={askingOff}
        onConfirm={confirmOff}
        onCancel={cancelOff}
      />
    </SettingsFrame>
  );
}
