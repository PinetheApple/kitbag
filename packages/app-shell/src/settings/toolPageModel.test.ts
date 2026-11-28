import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  KB_TOOL_REJECTION,
  type KB_TOOL_INSTALL_STAGE as Stage,
  type ToolCatalogueTool,
} from '@kitbag/core-native';
import {
  INSTALL_FAILURE,
  NO_TOOL_DATA,
  type ToolJob,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  INSTALLED_CARD,
  PAGE_DOCK,
  toolIcon,
  toolPageModel,
} from './toolPageModel.ts';

const ON = KB_TOOL_DOWNLOADS.on;
const STAGE = KB_TOOL_INSTALL_STAGE;
const R = KB_TOOL_REJECTION;

const TOOL: ToolCatalogueTool = {
  toolId: 'recorder',
  name: 'Practice recorder',
  icon: 'mic',
  summary: null,
  version: '0.9.0',
  sizeBytes: 1_600_000,
  capabilities: [],
  installedVersion: null,
  installedManifestSha256: null,
  installedBytes: 0,
  installedProblem: null,
  highWaterVersion: null,
};
const INSTALLED: ToolCatalogueTool = {
  ...TOOL,
  installedVersion: '0.9.0',
  installedBytes: 4_100_000,
};
const KEPT = { bytes: 38_000_000, items: 12 };

function job(stage: Stage, failure: ToolJob['failure'] = null): ToolJob {
  return {
    stage,
    receivedBytes: 0,
    totalBytes: 0,
    failure,
    neededBytes: 0,
    freeBytes: 0,
  };
}

describe('tool page frames', () => {
  it('offers Install for a tool not on the phone (3a)', () => {
    expect(toolPageModel(TOOL, undefined, ON, NO_TOOL_DATA)).toEqual({
      installed: false,
      card: null,
      dock: PAGE_DOCK.install,
      keptData: null,
    });
  });

  it('still offers Install while downloads were never asked, for the opt-in to catch', () => {
    expect(
      toolPageModel(TOOL, undefined, KB_TOOL_DOWNLOADS.unasked, NO_TOOL_DATA)
        .dock,
    ).toBe(PAGE_DOCK.install);
  });

  it('offers to turn downloads on while they are off (7d)', () => {
    expect(
      toolPageModel(TOOL, undefined, KB_TOOL_DOWNLOADS.off, NO_TOOL_DATA).dock,
    ).toBe(PAGE_DOCK.optIn);
  });

  it.each([
    [STAGE.downloading, PAGE_DOCK.downloading],
    [STAGE.retrying, PAGE_DOCK.downloading],
    [STAGE.checking, PAGE_DOCK.checking],
    [STAGE.installing, PAGE_DOCK.installing],
  ])('shows %s as its progress dock (4a, 4b)', (stage, dock) => {
    const page = toolPageModel(TOOL, job(stage), ON, KEPT);
    expect(page).toMatchObject({ installed: false, card: null, dock });
    expect(page.keptData).toBeNull();
  });

  it('says installed and offers Done once the install ends (4c)', () => {
    expect(
      toolPageModel(TOOL, job(STAGE.installed), ON, NO_TOOL_DATA),
    ).toMatchObject({
      installed: true,
      card: INSTALLED_CARD,
      dock: PAGE_DOCK.done,
    });
  });

  it.each([
    [R.signature, INSTALL_FAILURE.check],
    [R.download, INSTALL_FAILURE.download],
    [R.noSpace, INSTALL_FAILURE.noSpace],
    [R.internal, INSTALL_FAILURE.generic],
  ])('shows a %s failure with Try again (4e, 4f, 4g)', (failure, card) => {
    expect(
      toolPageModel(TOOL, job(STAGE.failed, failure), ON, NO_TOOL_DATA),
    ).toMatchObject({ card, dock: PAGE_DOCK.retry });
  });

  it('keeps Install as the retry after an offline failure (7a)', () => {
    expect(
      toolPageModel(TOOL, job(STAGE.failed, R.offline), ON, NO_TOOL_DATA),
    ).toMatchObject({ card: INSTALL_FAILURE.offline, dock: PAGE_DOCK.install });
  });

  it('sends a downloads-off failure to the opt-in with no card', () => {
    expect(
      toolPageModel(
        TOOL,
        job(STAGE.failed, R.downloadsOff),
        KB_TOOL_DOWNLOADS.off,
        NO_TOOL_DATA,
      ),
    ).toMatchObject({ card: null, dock: PAGE_DOCK.optIn });
  });

  it('offers Install again once downloads are back on after a downloads-off failure', () => {
    expect(
      toolPageModel(TOOL, job(STAGE.failed, R.downloadsOff), ON, NO_TOOL_DATA),
    ).toMatchObject({ card: null, dock: PAGE_DOCK.install });
  });

  it('offers Remove for an installed tool (6a)', () => {
    expect(toolPageModel(INSTALLED, undefined, ON, KEPT)).toEqual({
      installed: true,
      card: null,
      dock: PAGE_DOCK.remove,
      keptData: null,
    });
  });

  it('shows the data a removed tool left behind (6e)', () => {
    expect(toolPageModel(TOOL, undefined, ON, KEPT).keptData).toBe(KEPT);
  });
});

describe('toolIcon', () => {
  it('uses the catalogue icon when the app has it, and a neutral one otherwise', () => {
    expect(toolIcon('mic')).toBe('mic');
    expect(toolIcon('no-such-icon')).toBe('moreTools');
    expect(toolIcon(null)).toBe('moreTools');
  });
});
