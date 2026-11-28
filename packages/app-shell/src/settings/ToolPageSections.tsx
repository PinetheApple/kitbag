import {
  Badge,
  Button,
  Card,
  createThemedStyles,
  EditGroup,
  EditRow,
  EditSwitchRow,
  EditValue,
  Icon,
  rowLineHeight,
  RowIcon,
  SectionHeader,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import type { ToolCatalogue, ToolCatalogueTool } from '@kitbag/core-native';
import {
  isInstalled,
  type ToolDataUsage,
  type ToolJob,
} from '@kitbag/core-state';
import { Text, View } from 'react-native';

import { formatBytes } from './bytes.ts';
import {
  toolIcon,
  type PageCard,
  type ToolPageModel,
} from './toolPageModel.ts';
import {
  BUILT_FOR_LABEL,
  builtForValue,
  cardText,
  DATA_LABEL,
  dataValue,
  DELETE_DATA,
  DETAILS_LABEL,
  DOWNLOAD_SIZE_LABEL,
  INSTALLED_BADGE,
  itemCount,
  KEPT_BRINGS_BACK,
  KEPT_LABEL,
  ON_LABEL,
  ON_THIS_PHONE_LABEL,
  SIGNED_BY_LABEL,
  SIGNED_BY_VALUE,
  SOURCE_LABEL,
  SOURCE_VALUE,
  TOOL_SIZE_LABEL,
  VERSION_LABEL,
} from './toolPageText.ts';
import { useToolScreenStyles } from './toolScreenStyles.ts';
import { NOT_INSTALLED, toolName } from './toolsText.ts';

const useStyles = createThemedStyles((theme) => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.sectionGap },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.chipGap },
  cardTitle: {
    ...textStyle(textRoles.rowTitle),
    lineHeight: rowLineHeight.title,
    color: theme.color.text,
  },
}));

function StatusCard({
  card,
  name,
  job,
}: {
  readonly card: PageCard;
  readonly name: string;
  readonly job: ToolJob | undefined;
}) {
  const styles = useStyles();
  const shared = useToolScreenStyles();
  const text = cardText(card, name, job);
  return (
    <Card emphasis={text.tone} statusIcon={text.icon} statusLabel={text.title}>
      <Text accessibilityLiveRegion="polite" style={styles.cardTitle}>
        {text.title}
      </Text>
      <Text style={shared.body}>{text.body}</Text>
    </Card>
  );
}

function shownVersion(tool: ToolCatalogueTool): string {
  return tool.installedVersion ?? tool.version ?? '';
}

function Hero({
  tool,
  installed,
}: {
  readonly tool: ToolCatalogueTool;
  readonly installed: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.hero}>
      <RowIcon icon={toolIcon(tool.icon)} />
      <View style={styles.badges}>
        {installed ? (
          <>
            <Badge tone="success" label={INSTALLED_BADGE} />
            <Badge label={shownVersion(tool)} />
          </>
        ) : (
          <Badge label={NOT_INSTALLED} />
        )}
      </View>
    </View>
  );
}

function OnThisPhone({
  tool,
  on,
  data,
  onSwitch,
}: {
  readonly tool: ToolCatalogueTool;
  readonly on: boolean;
  readonly data: ToolDataUsage;
  readonly onSwitch: (on: boolean) => void;
}) {
  return (
    <>
      <SectionHeader label={ON_THIS_PHONE_LABEL} />
      <EditGroup>
        <EditSwitchRow label={ON_LABEL} value={on} onValueChange={onSwitch} />
        <EditRow label={TOOL_SIZE_LABEL}>
          <EditValue>{formatBytes(tool.installedBytes)}</EditValue>
        </EditRow>
        <EditRow label={DATA_LABEL}>
          <EditValue>{dataValue(data)}</EditValue>
        </EditRow>
      </EditGroup>
    </>
  );
}

function KeptData({
  data,
  onDelete,
}: {
  readonly data: ToolDataUsage;
  readonly onDelete: () => void;
}) {
  return (
    <>
      <SectionHeader label={KEPT_LABEL} />
      <EditGroup>
        <EditRow label={itemCount(data.items)}>
          <EditValue>{formatBytes(data.bytes)}</EditValue>
        </EditRow>
        <EditRow label={KEPT_BRINGS_BACK}>
          <Button
            size="small"
            icon="delete"
            label={DELETE_DATA}
            onPress={onDelete}
          />
        </EditRow>
      </EditGroup>
    </>
  );
}

function builtForThisRelease(
  tool: ToolCatalogueTool,
  catalogue: ToolCatalogue,
): string | null {
  const host = catalogue.hostVersionName;
  if (host === null) return null;
  const sameBuild =
    !isInstalled(tool) || tool.installedVersion === tool.version;
  return sameBuild ? builtForValue(host) : null;
}

function Details({
  tool,
  catalogue,
}: {
  readonly tool: ToolCatalogueTool;
  readonly catalogue: ToolCatalogue;
}) {
  const builtFor = builtForThisRelease(tool, catalogue);
  return (
    <>
      <SectionHeader label={DETAILS_LABEL} />
      <EditGroup>
        <EditRow label={VERSION_LABEL}>
          <EditValue>{shownVersion(tool)}</EditValue>
        </EditRow>
        {isInstalled(tool) ? null : (
          <EditRow label={DOWNLOAD_SIZE_LABEL}>
            <EditValue>{formatBytes(tool.sizeBytes)}</EditValue>
          </EditRow>
        )}
        {builtFor === null ? null : (
          <EditRow label={BUILT_FOR_LABEL}>
            <Icon name="success" size="control" color="green" />
            <EditValue>{builtFor}</EditValue>
          </EditRow>
        )}
        <EditRow label={SOURCE_LABEL}>
          <EditValue>{SOURCE_VALUE}</EditValue>
        </EditRow>
        <EditRow label={SIGNED_BY_LABEL}>
          <Icon name="trusted" size="control" color="text" />
          <EditValue>{SIGNED_BY_VALUE}</EditValue>
        </EditRow>
      </EditGroup>
    </>
  );
}

interface PageBodyProps {
  readonly tool: ToolCatalogueTool;
  readonly catalogue: ToolCatalogue;
  readonly model: ToolPageModel;
  readonly job: ToolJob | undefined;
  readonly data: ToolDataUsage;
  readonly on: boolean;
  readonly onSwitch: (on: boolean) => void;
  readonly onDeleteData: () => void;
}

export function PageBody({
  tool,
  catalogue,
  model,
  job,
  data,
  on,
  onSwitch,
  onDeleteData,
}: PageBodyProps) {
  const shared = useToolScreenStyles();
  return (
    <>
      {model.card === null ? null : (
        <StatusCard card={model.card} name={toolName(tool)} job={job} />
      )}
      <Hero tool={tool} installed={model.installed} />
      {tool.summary === null ? null : (
        <Text style={shared.body}>{tool.summary}</Text>
      )}
      {isInstalled(tool) ? (
        <OnThisPhone tool={tool} on={on} data={data} onSwitch={onSwitch} />
      ) : null}
      {model.keptData === null ? null : (
        <KeptData data={model.keptData} onDelete={onDeleteData} />
      )}
      <Details tool={tool} catalogue={catalogue} />
    </>
  );
}
