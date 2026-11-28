import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { TOOL_REGISTRY_KEY } from '@kitbag/core-plugin-api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HOST_API } from '../toolHost/hostApi';
import { probeGlobals, stubModule } from './globalsProbe';
import { hbcBytecodeVersion } from './hermes';
import { SHADOWED_HOST_GLOBALS } from './metroBundle';
import {
  ASSET,
  BUILD_HOOK_TIMEOUT_MS,
  buildTool,
  copyTree,
  EXIT_OK,
  EXIT_REJECTED,
  EXIT_USAGE,
  FIXTURE,
  HOST_VERSION,
  HOST_VERSION_CODE,
  makeScratch,
  readManifest,
  run,
  scratchDir,
  zipEntry,
  type Run,
} from './testSupport';
import { readZip } from './zip';

const scratch = makeScratch('kbt-build-');
const BUNDLE_JS = 'build/sample/bundle.js';

let built = '';
let builtRun: Run = { status: null, output: '' };

function toolWithEntry(name: string, source: string): string {
  const tool = copyTree(FIXTURE, path.join(scratch, name));
  writeFileSync(path.join(tool, 'src/index.tsx'), source);
  return tool;
}

beforeAll(() => {
  built = scratchDir(scratch, 'built');
  builtRun = buildTool(built);
}, BUILD_HOOK_TIMEOUT_MS);

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe.each(['build-tool.sh', 'sign-tools.sh', 'tools-gate.sh'])(
  '%s',
  (script) => {
    it('prints usage with its exit codes on -h', () => {
      const help = run(script, ['-h']);
      expect(help.status).toBe(EXIT_USAGE);
      expect(help.output).toMatch(/^usage: /m);
      expect(help.output).toMatch(/^exit 0 /m);
    });

    it('rejects an unknown option as a usage error', () => {
      const result = run(script, ['--bogus', scratch]);
      expect(result.status).toBe(EXIT_USAGE);
      expect(result.output).toContain('unknown option --bogus');
    });
  },
);

describe('build-tool.sh', () => {
  it('builds the fixture into one bundle', () => {
    expect(builtRun.status, builtRun.output).toBe(EXIT_OK);
    expect(readdirSync(built).filter((f) => f.endsWith('.kbt'))).toEqual([
      ASSET,
    ]);
  });

  it('zips the manifest, the bytecode and the assets, unsigned', () => {
    const names = readZip(readFileSync(path.join(built, ASSET))).map(
      (e) => e.name,
    );
    expect(names.sort()).toEqual([
      'assets/notes.json',
      'bundle.hbc',
      'manifest.json',
    ]);
  });

  it('writes a manifest that lists every file with its hash and size', () => {
    const manifest = readManifest(readFileSync(path.join(built, ASSET)));
    const sizes = manifest.files.map((f) => f.size);
    expect(manifest).toMatchObject({
      schema: 1,
      id: 'sample',
      version: '1.2.3',
      entry: 'bundle.hbc',
      hostApi: { major: HOST_API.major, minMinor: HOST_API.minor },
      host: {
        minVersionCode: HOST_VERSION_CODE,
        maxVersionCode: null,
        builtWith: HOST_VERSION,
      },
      routes: ['/t/sample'],
      homeTile: { label: 'Sample', route: '/t/sample' },
    });
    expect(manifest.size).toBe(sizes.reduce((sum, size) => sum + size, 0));
    expect(manifest.files.map((f) => f.path).sort()).toEqual([
      'assets/notes.json',
      'bundle.hbc',
    ]);
    expect(manifest).not.toHaveProperty('signature');
  });

  it('pins the bytecode version the host hermesc wrote', () => {
    const zip = readFileSync(path.join(built, ASSET));
    expect(readManifest(zip).runtime.hermesBytecodeVersion).toBe(
      hbcBytecodeVersion(zipEntry(zip, 'bundle.hbc')),
    );
  });

  it('emits JavaScript that adds no global, before or after register() runs', () => {
    const js = readFileSync(path.join(built, BUNDLE_JS), 'utf8');
    const registered: { id: string; register: unknown }[] = [];
    const probe = probeGlobals(
      js,
      (global) => {
        global[TOOL_REGISTRY_KEY] = {
          module: () => stubModule(),
          register: (id: string, register: unknown) =>
            registered.push({ id, register }),
        };
      },
      () => {
        for (const { register } of registered)
          (register as (host: unknown) => unknown)(stubModule());
      },
    );
    expect(probe).toEqual({ added: [], changed: [] });
    expect(registered.map(({ id, register }) => [id, typeof register])).toEqual(
      [['sample', 'function']],
    );
  });

  it("shadows core-native's HostObject global on the tool scope", () => {
    expect(SHADOWED_HOST_GLOBALS).toContain(KITBAG_HOST_OBJECT_KEY);
  });

  it('rebuilds byte for byte (unsigned; ECDSA signatures are randomized)', () => {
    const again = scratchDir(scratch, 'again');
    const result = buildTool(again);
    expect(result.status, result.output).toBe(EXIT_OK);
    expect(
      readFileSync(path.join(again, BUNDLE_JS)).equals(
        readFileSync(path.join(built, BUNDLE_JS)),
      ),
    ).toBe(true);
    expect(
      readFileSync(path.join(again, ASSET)).equals(
        readFileSync(path.join(built, ASSET)),
      ),
    ).toBe(true);
  });

  it('fails a tool whose register() leaks a global through Function', () => {
    const tool = toolWithEntry(
      'tool-leaky',
      [
        "import type { ToolHost, ToolPlugin } from '@kitbag/core-plugin-api';",
        'export function register(host: ToolHost): ToolPlugin {',
        "  (Function('return this')() as Record<string, unknown>).kbtLeak = 1;",
        "  return { id: 'sample', name: 'Sample', icon: 'metronome', routes: [] };",
        '}',
        '',
      ].join('\n'),
    );
    const result = buildTool(scratchDir(scratch, 'out-leaky'), tool);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('the bundle writes host globals: kbtLeak');
  });

  it('fails a tool that imports a package off the allowlist', () => {
    const tool = copyTree(FIXTURE, path.join(scratch, 'tool-zustand'));
    writeFileSync(
      path.join(tool, 'src/store.ts'),
      "export { create } from 'zustand';\n",
    );
    writeFileSync(
      path.join(tool, 'src/index.tsx'),
      "export * from './store';\n",
      { flag: 'a' },
    );
    const result = buildTool(scratchDir(scratch, 'out-zustand'), tool);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain(
      'imports zustand, which is not on the downloadable allowlist',
    );
  });

  it('fails a tool whose path import leaves its package', () => {
    const tool = copyTree(FIXTURE, path.join(scratch, 'tool-escape'));
    const repoFile = path.join(FIXTURE, 'src/routes');
    writeFileSync(
      path.join(tool, 'src/index.tsx'),
      `export * from '${repoFile}';\n`,
      { flag: 'a' },
    );
    const result = buildTool(scratchDir(scratch, 'out-escape'), tool);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('which is outside the tool package');
  });
});
