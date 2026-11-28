import type { ToolCatalogue, ToolCatalogueTool } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  findTool,
  toolCounts,
  toolDataUsage,
  toolSections,
} from './catalogue.ts';

const BUILT = ['metronome', 'tuner'];

function tool(
  toolId: string,
  installedVersion: string | null = null,
): ToolCatalogueTool {
  return {
    toolId,
    name: toolId,
    icon: null,
    summary: null,
    version: '1.0.0',
    sizeBytes: 1000,
    capabilities: [],
    installedVersion,
    installedManifestSha256: null,
    installedBytes: installedVersion === null ? 0 : 3000,
    installedProblem: null,
    highWaterVersion: null,
  };
}

function catalogue(tools: readonly ToolCatalogueTool[]): ToolCatalogue {
  return {
    hostVersionName: '0.31.0',
    indexProblem: null,
    highWaterProblem: null,
    tools,
  };
}

const MIXED = catalogue([
  tool('drone', '1.0.2'),
  tool('recorder'),
  tool('chords'),
  tool('tuner'),
]);

describe('tool sections', () => {
  it('splits the catalogue into built in, downloaded and to download', () => {
    const sections = toolSections(BUILT, MIXED);
    expect(sections.builtIn).toEqual(BUILT);
    expect(sections.downloaded.map((t) => t.toolId)).toEqual(['drone']);
    expect(sections.toDownload.map((t) => t.toolId)).toEqual([
      'recorder',
      'chords',
    ]);
  });

  it('lists only the built-in tools before the catalogue has loaded', () => {
    expect(toolSections(BUILT, null)).toEqual({
      builtIn: BUILT,
      downloaded: [],
      toDownload: [],
    });
  });

  it('counts downloaded tools among those on, and what is left to download', () => {
    const sections = toolSections(BUILT, MIXED);
    expect(toolCounts(sections, [])).toEqual({ on: 3, toDownload: 2 });
    expect(toolCounts(sections, ['drone'])).toEqual({ on: 2, toDownload: 2 });
  });

  it('applies the one-tool-on rule to built-in tools only', () => {
    const sections = toolSections(BUILT, MIXED);
    expect(toolCounts(sections, BUILT).on).toBe(3);
  });
});

describe('tool data usage', () => {
  it('adds the UTF-8 bytes of every key and value and counts the items', () => {
    expect(
      toolDataUsage([
        { key: 'ab', value: '"é"' },
        { key: 'c', value: '1' },
      ]),
    ).toEqual({ bytes: 2 + 4 + 1 + 1, items: 2 });
  });

  it('is empty for a tool with no data', () => {
    expect(toolDataUsage([])).toEqual({ bytes: 0, items: 0 });
  });
});

it('finds a tool in the catalogue by id', () => {
  expect(findTool(MIXED, 'chords')?.toolId).toBe('chords');
  expect(findTool(MIXED, 'nope')).toBeUndefined();
  expect(findTool(null, 'chords')).toBeUndefined();
});
