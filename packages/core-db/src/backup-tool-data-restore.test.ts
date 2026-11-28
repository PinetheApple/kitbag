import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  IMPORT_CATEGORIES,
  TOOL_DATA_CATEGORY,
  type ImportCategory,
  type ImportMode,
} from './backup-format';
import { toSeconds } from './backup-snapshot';
import { TOOL_DATA_SECTION_VERSION } from './backup-tool-data';
import {
  openBackupDatabase,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import {
  createToolDataRepository,
  MAX_TOOL_DATA_KEY_BYTES,
  MAX_TOOL_DATA_VALUE_BYTES,
  selectAllToolData,
} from './tool-data-repository';

const SAVED_AT = new Date('2026-11-27T10:00:00Z');
const LATER = new Date('2026-11-28T10:00:00Z');

async function withToolData(
  entries: readonly [string, string, string][],
  savedAt = SAVED_AT,
) {
  const database = openBackupDatabase();
  await seed(database);
  const toolData = createToolDataRepository(database.handle, () => savedAt);
  for (const [toolId, key, value] of entries)
    await toolData.forTool(toolId).set(key, value);
  return { ...database, toolData };
}

const SOURCE_ENTRIES: [string, string, string][] = [
  ['chords', 'favourites', '["Am7"]'],
  ['drone', 'note', '{"pitch":"D"}'],
];

const rows = (database: BackupDatabase) =>
  selectAllToolData(database.handle.db);

async function plan(
  target: BackupDatabase,
  text: string,
  mode: ImportMode,
  categories?: readonly ImportCategory[],
) {
  return target.backup.plan(text, {
    mode,
    ...(categories === undefined ? {} : { categories }),
  });
}

async function restore(
  target: BackupDatabase,
  text: string,
  mode: ImportMode,
  categories?: readonly ImportCategory[],
) {
  const planned = unwrap(await plan(target, text, mode, categories));
  return target.backup.apply(planned, { confirmReplace: true });
}

function withRecords(text: string, records: unknown[]) {
  const root = JSON.parse(text) as Record<string, unknown>;
  return JSON.stringify({
    ...root,
    toolData: { version: TOOL_DATA_SECTION_VERSION, records },
  });
}

const record = (fields: Record<string, unknown>) => ({
  toolId: 'chords',
  key: 'favourites',
  value: '["Am7"]',
  updatedAt: toSeconds(SAVED_AT),
  ...fields,
});

describe('restoring tool data', () => {
  it.each<ImportMode>(['merge', 'replace'])(
    'round-trips every record into an empty database on %s',
    async (mode) => {
      const source = await withToolData(SOURCE_ENTRIES);
      const target = openBackupDatabase();
      unwrap(
        await restore(
          target,
          await source.backup.export(),
          mode,
          IMPORT_CATEGORIES,
        ),
      );
      expect(await rows(target)).toEqual(await rows(source));
    },
  );

  it('selects tool data by default when the file carries it', async () => {
    const source = await withToolData(SOURCE_ENTRIES);
    const planned = unwrap(
      await plan(openBackupDatabase(), await source.backup.export(), 'merge'),
    );
    expect(planned.categories).toContain(TOOL_DATA_CATEGORY);
  });

  it('counts the records the file carries', async () => {
    const source = await withToolData(SOURCE_ENTRIES);
    const planned = unwrap(
      await plan(openBackupDatabase(), await source.backup.export(), 'merge'),
    );
    expect(planned.counts.toolData).toMatchObject({ incoming: 2, new: 2 });
  });

  it('leaves tool data out of the selection when the file has none', async () => {
    const bare = openBackupDatabase();
    await seed(bare);
    const planned = unwrap(
      await plan(openBackupDatabase(), await bare.backup.export(), 'merge'),
    );
    expect(planned.categories).not.toContain(TOOL_DATA_CATEGORY);
  });

  it('refuses tool data asked for from a file without it', async () => {
    const bare = openBackupDatabase();
    await seed(bare);
    const text = await bare.backup.export();
    expect(
      await plan(openBackupDatabase(), text, 'merge', [TOOL_DATA_CATEGORY]),
    ).toMatchObject({ ok: false, error: { kind: 'categoryNotInFile' } });
  });
});

describe('replacing with tool data', () => {
  it("clears tool data and writes the file's when its row is selected", async () => {
    const source = await withToolData(SOURCE_ENTRIES);
    const target = await withToolData([['metronome-extra', 'mine', '1']]);
    unwrap(
      await restore(
        target,
        await source.backup.export(),
        'replace',
        IMPORT_CATEGORIES,
      ),
    );
    expect(await rows(target)).toEqual(await rows(source));
  });

  it('keeps tool data when the file carries it but its row is not selected', async () => {
    const source = await withToolData(SOURCE_ENTRIES);
    const target = await withToolData([['chords', 'favourites', '["G"]']]);
    const before = await rows(target);
    unwrap(
      await restore(
        target,
        await source.backup.export(),
        'replace',
        CATEGORIES,
      ),
    );
    expect(await rows(target)).toEqual(before);
  });

  it('counts the tool data it deletes', async () => {
    const source = await withToolData(SOURCE_ENTRIES);
    const target = await withToolData([['looper', 'bars', '1']]);
    const planned = unwrap(
      await plan(target, await source.backup.export(), 'replace', [
        TOOL_DATA_CATEGORY,
      ]),
    );
    expect(planned.counts.toolData).toMatchObject({
      incoming: 2,
      new: 2,
      deletes: 1,
    });
  });
});

describe('merging tool data', () => {
  async function diverged() {
    const source = await withToolData([
      ['chords', 'favourites', '["Am7"]'],
      ['drone', 'note', '{"pitch":"D"}'],
      ['drone', 'volume', '0.5'],
    ]);
    const target = await withToolData(
      [
        ['chords', 'favourites', '["G"]'],
        ['drone', 'note', '{"pitch":"D"}'],
        ['tuner-extra', 'mine', '1'],
      ],
      LATER,
    );
    return { source, target, text: await source.backup.export() };
  }

  it('adds new keys, leaves equal values alone and lists a differing value as a conflict', async () => {
    const { target, text } = await diverged();
    const planned = unwrap(await plan(target, text, 'merge'));
    expect(planned.counts.toolData).toEqual({
      incoming: 3,
      new: 1,
      unchanged: 1,
      updates: 0,
      deletes: 0,
      conflicts: [
        {
          category: TOOL_DATA_CATEGORY,
          key: 'chords:favourites',
          label: 'chords:favourites',
        },
      ],
    });
  });

  it('writes nothing while a conflict is unresolved', async () => {
    const { target, text } = await diverged();
    const before = await rows(target);
    const planned = unwrap(await plan(target, text, 'merge'));
    expect(await target.backup.apply(planned)).toMatchObject({
      ok: false,
      error: { kind: 'unresolvedConflicts' },
    });
    expect(await rows(target)).toEqual(before);
  });

  it('keeps the existing record on keep mine and adds the new key', async () => {
    const { target, text } = await diverged();
    const planned = unwrap(
      await target.backup.plan(text, {
        resolutions: { toolData: { 'chords:favourites': 'mine' } },
      }),
    );
    unwrap(await target.backup.apply(planned));
    const after = await rows(target);
    expect(after.map(({ toolId, key, value }) => [toolId, key, value])).toEqual(
      [
        ['chords', 'favourites', '["G"]'],
        ['drone', 'note', '{"pitch":"D"}'],
        ['drone', 'volume', '0.5'],
        ['tuner-extra', 'mine', '1'],
      ],
    );
    expect(after[0]?.updatedAt).toEqual(LATER);
  });

  it("takes the file's value on take theirs", async () => {
    const { target, text } = await diverged();
    const planned = unwrap(
      await target.backup.plan(text, {
        resolutions: { toolData: { 'chords:favourites': 'theirs' } },
      }),
    );
    unwrap(await target.backup.apply(planned));
    const [chords] = await rows(target);
    expect(chords).toEqual({
      toolId: 'chords',
      key: 'favourites',
      value: '["Am7"]',
      updatedAt: SAVED_AT,
    });
  });
});

describe('the copy kept before a replace of tool data', () => {
  async function keptCopy(target: BackupDatabase) {
    const kept = await target.backup.keptBeforeReplace();
    if (kept === null) throw new Error('no copy kept');
    return kept;
  }

  it('holds the tool data the replace cleared and brings it back', async () => {
    const source = await withToolData(SOURCE_ENTRIES);
    const target = await withToolData([['tuner-extra', 'mine', '1']]);
    const before = await rows(target);
    const text = await source.backup.export();
    unwrap(await restore(target, text, 'replace', [TOOL_DATA_CATEGORY]));
    const kept = await keptCopy(target);
    expect(kept.categories).toEqual([TOOL_DATA_CATEGORY]);
    unwrap(await restore(target, kept.contents, 'replace', kept.categories));
    expect(await rows(target)).toEqual(before);
  });

  async function replacedOntoNone() {
    const source = await withToolData(SOURCE_ENTRIES);
    const target = openBackupDatabase();
    await seed(target);
    const text = await source.backup.export();
    unwrap(await restore(target, text, 'replace', IMPORT_CATEGORIES));
    return { target, kept: await keptCopy(target) };
  }

  it('carries an empty tool data section from a phone that had none', async () => {
    const { kept } = await replacedOntoNone();
    const root = JSON.parse(kept.contents) as Record<string, unknown>;
    expect(root.toolData).toEqual({
      version: TOOL_DATA_SECTION_VERSION,
      records: [],
    });
  });

  it('lists tool data among the categories it replaced', async () => {
    const { kept } = await replacedOntoNone();
    expect(kept.categories).toEqual(IMPORT_CATEGORIES);
  });

  it('clears the tool data the replace added when undone', async () => {
    const { target, kept } = await replacedOntoNone();
    unwrap(await restore(target, kept.contents, 'replace', kept.categories));
    expect(await rows(target)).toEqual([]);
  });
});

describe('a tool data record the repository would refuse', () => {
  const tooLarge = JSON.stringify('x'.repeat(MAX_TOOL_DATA_VALUE_BYTES));
  const longKey = 'k'.repeat(MAX_TOOL_DATA_KEY_BYTES + 1);

  it.each([
    ['a value that is not JSON', record({ value: '{' })],
    ['a value over the size cap', record({ value: tooLarge })],
    ['a key over the size cap', record({ key: longKey })],
    ['an empty tool id', record({ toolId: '' })],
    ['a tool id the manifest rules refuse', record({ toolId: 'a:b' })],
    ['a missing value', record({ value: undefined })],
    ['a negative time', record({ updatedAt: -1 })],
  ])('rejects the file for %s, writing nothing', async (_name, bad) => {
    const bare = openBackupDatabase();
    await seed(bare);
    const target = await withToolData([['chords', 'favourites', '["G"]']]);
    const before = await rows(target);
    const text = withRecords(await bare.backup.export(), [bad]);
    expect(await plan(target, text, 'merge')).toMatchObject({
      ok: false,
      error: { kind: 'invalidField' },
    });
    expect(await rows(target)).toEqual(before);
  });

  it('rejects the file for a repeated tool id and key', async () => {
    const bare = openBackupDatabase();
    await seed(bare);
    const text = withRecords(await bare.backup.export(), [
      record({}),
      record({}),
    ]);
    expect(await plan(openBackupDatabase(), text, 'merge')).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.toolData.records[1]' },
    });
  });
});
