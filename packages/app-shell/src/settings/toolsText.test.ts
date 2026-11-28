import { KB_TOOL_DOWNLOADS, type ToolCatalogueTool } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { TOOL_ID } from '../home/registry.ts';

import {
  downloadedSubtitle,
  LAST_ON_REASON,
  removedNotice,
  TOOLS_INTRO,
  TOOLS_NOTE,
  toDownloadSubtitle,
  toolsRowSummary,
  toolSwitchStep,
} from './toolsText.ts';

const RECORDER: ToolCatalogueTool = {
  toolId: 'recorder',
  name: 'Practice recorder',
  icon: 'mic',
  summary: 'Record with the click, play it back',
  version: '0.9.0',
  sizeBytes: 1_600_000,
  capabilities: [],
  installedVersion: null,
  installedManifestSha256: null,
  installedBytes: 0,
  installedProblem: null,
  highWaterVersion: null,
};

describe('toolsRowSummary', () => {
  const counts = { on: 7, toDownload: 4 };

  it('adds the download count only while downloads are on', () => {
    expect(toolsRowSummary(counts, KB_TOOL_DOWNLOADS.on)).toBe(
      '7 on · 4 to download',
    );
  });

  it.each([KB_TOOL_DOWNLOADS.unasked, KB_TOOL_DOWNLOADS.off, null])(
    'counts only the tools on while downloads read %s',
    (downloads) => {
      expect(toolsRowSummary(counts, downloads)).toBe('7 on');
    },
  );
});

describe('row subtitles', () => {
  it('gives a downloaded tool its version and size', () => {
    expect(
      downloadedSubtitle({
        ...RECORDER,
        installedVersion: '1.0.2',
        installedBytes: 2_600_000,
      }),
    ).toBe('1.0.2 · 2.6 MB');
  });

  it('gives a tool to download its size and summary', () => {
    expect(toDownloadSubtitle(RECORDER, { bytes: 0, items: 0 })).toBe(
      '1.6 MB · Record with the click, play it back',
    );
  });

  it('says a removed tool left its data behind', () => {
    expect(toDownloadSubtitle(RECORDER, { bytes: 38_000_000, items: 12 })).toBe(
      '1.6 MB · Not installed · data kept, 38 MB',
    );
  });
});

it('says whether a removed tool kept its data', () => {
  expect(removedNotice('Practice recorder', true)).toBe(
    'Practice recorder removed. Its data is kept.',
  );
  expect(removedNotice('Practice recorder', false)).toBe(
    'Practice recorder removed.',
  );
});

describe('toolSwitchStep', () => {
  it('switches a tool off and keeps the usual note', () => {
    expect(toolSwitchStep([], TOOL_ID.tuner, false)).toEqual({
      off: [TOOL_ID.tuner],
      note: TOOLS_NOTE,
    });
  });

  it('switches a downloaded tool on and off', () => {
    expect(toolSwitchStep([], 'drone', false).off).toEqual(['drone']);
    expect(toolSwitchStep(['drone'], 'drone', true).off).toEqual([]);
  });

  const allButTuner = [
    TOOL_ID.metronome,
    TOOL_ID.library,
    TOOL_ID.stems,
    TOOL_ID.sync,
  ];

  it('refuses to switch off the last built-in tool on, and says why', () => {
    expect(toolSwitchStep(allButTuner, TOOL_ID.tuner, false)).toEqual({
      off: allButTuner,
      note: LAST_ON_REASON,
    });
  });

  it('keeps a built-in tool on even while a downloaded tool is on', () => {
    expect(toolSwitchStep(allButTuner, TOOL_ID.tuner, false).note).toBe(
      LAST_ON_REASON,
    );
  });
});

describe('Tools text', () => {
  it('says a switch acts everywhere and Home tiles are chosen on Home', () => {
    expect(TOOLS_INTRO).toBe(
      'Turn a tool off to hide it everywhere. Nothing is deleted.',
    );
    expect(TOOLS_NOTE).toBe(
      'Choose Home tiles with Edit on Home. Other tools are under More tools.',
    );
  });
});
