import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  TOOL_ENTRY_EXPORT,
  TOOL_REGISTRY_KEY,
} from '../toolHost/bundleContract.ts';
import { HOST_API } from '../toolHost/hostApi.ts';
import { probeGlobals, stubModule } from './globalsProbe.ts';
import {
  compileHermes,
  hbcBytecodeVersion,
  installedRuntime,
} from './hermes.ts';
import {
  ASSETS_DIR,
  BUNDLE_ENTRY,
  isJsonObject,
  kbtAssetName,
  MANIFEST_FILE,
  manifestProblems,
  SCHEMA_VERSION,
  type ManifestFile,
  type ToolManifest,
  type ToolMetadata,
} from './manifest.ts';
import { bundleTool } from './metroBundle.ts';
import { BuildError } from './paths.ts';
import { sha256 } from './signature.ts';
import { writeZip, type ZipEntry } from './zip.ts';

export interface BuildRequest {
  readonly toolDir: string;
  readonly outDir: string;
  readonly hostVersion: string;
  readonly hostVersionCode: number;
}

interface ToolPackage {
  readonly version: string;
  readonly main: string;
  readonly tool: ToolMetadata;
}

function readToolPackage(toolDir: string): ToolPackage {
  const pkg: unknown = JSON.parse(
    readFileSync(path.join(toolDir, 'package.json'), 'utf8'),
  );
  const kitbag = isJsonObject(pkg) ? pkg.kitbag : undefined;
  if (
    !isJsonObject(pkg) ||
    !isJsonObject(kitbag) ||
    kitbag.downloadable !== true ||
    !isJsonObject(kitbag.tool) ||
    typeof kitbag.tool.id !== 'string'
  ) {
    throw new BuildError(
      `${toolDir}/package.json needs kitbag.downloadable and kitbag.tool`,
    );
  }
  if (typeof pkg.version !== 'string' || typeof pkg.main !== 'string') {
    throw new BuildError(`${toolDir}/package.json needs version and main`);
  }
  return {
    version: pkg.version,
    main: pkg.main,
    tool: kitbag.tool as unknown as ToolMetadata,
  };
}

interface Registration {
  readonly id: string;
  readonly register: (host: unknown) => unknown;
}

function assertScoped(js: string, id: string): void {
  const registered: Registration[] = [];
  const probe = probeGlobals(
    js,
    (global) => {
      global[TOOL_REGISTRY_KEY] = {
        module: () => stubModule(),
        register: (registeredId: string, register: unknown) => {
          if (typeof register === 'function') {
            registered.push({
              id: registeredId,
              register: register as Registration['register'],
            });
          }
        },
      };
    },
    () => {
      for (const registration of registered)
        registration.register(stubModule());
    },
  );
  const leaked = [...probe.added, ...probe.changed];
  if (leaked.length > 0) {
    throw new BuildError(
      `the bundle writes host globals: ${leaked.join(', ')}`,
    );
  }
  if (registered.length !== 1 || registered[0]?.id !== id) {
    throw new BuildError(
      `the entry must export ${TOOL_ENTRY_EXPORT} and register once as ${id}`,
    );
  }
}

function assetFiles(toolDir: string, dir: string = ASSETS_DIR): string[] {
  const absolute = path.join(toolDir, dir);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${dir}/${entry.name}`;
      return entry.isDirectory() ? assetFiles(toolDir, relative) : [relative];
    })
    .sort();
}

function listFiles(entries: readonly ZipEntry[]): ManifestFile[] {
  return entries.map(({ name, data }) => ({
    path: name,
    sha256: sha256(data),
    size: data.length,
  }));
}

function manifestFor(
  request: BuildRequest,
  pkg: ToolPackage,
  files: ManifestFile[],
  hbc: Buffer,
): ToolManifest {
  const hermesBytecodeVersion = hbcBytecodeVersion(hbc);
  if (hermesBytecodeVersion === undefined)
    throw new BuildError('hermesc wrote no Hermes bytecode header');
  return {
    schema: SCHEMA_VERSION,
    ...pkg.tool,
    version: pkg.version,
    hostApi: { major: HOST_API.major, minMinor: HOST_API.minor },
    host: {
      minVersionCode: request.hostVersionCode,
      maxVersionCode: null,
      builtWith: request.hostVersion,
    },
    runtime: { hermesBytecodeVersion, ...installedRuntime() },
    entry: BUNDLE_ENTRY,
    files,
    size: files.reduce((sum, file) => sum + file.size, 0),
  };
}

const BUNDLE_JS = 'bundle.js';

interface Compiled {
  readonly js: string;
  readonly hbc: Buffer;
}

async function compileBundle(
  toolDir: string,
  pkg: ToolPackage,
  workDir: string,
): Promise<Compiled> {
  const js = await bundleTool({
    toolDir,
    entry: path.resolve(toolDir, pkg.main),
    id: pkg.tool.id,
    workDir,
  });
  assertScoped(js, pkg.tool.id);
  writeFileSync(path.join(workDir, BUNDLE_JS), js);
  compileHermes(workDir, BUNDLE_JS, BUNDLE_ENTRY);
  return { js, hbc: readFileSync(path.join(workDir, BUNDLE_ENTRY)) };
}

function packKbt(
  outDir: string,
  manifest: ToolManifest,
  payload: readonly ZipEntry[],
): string {
  const problems = manifestProblems(manifest, { signed: false });
  if (problems.length > 0)
    throw new BuildError(`invalid manifest: ${problems.join('; ')}`);
  const kbt = path.join(outDir, kbtAssetName(manifest.id, manifest.version));
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    kbt,
    writeZip([{ name: MANIFEST_FILE, data: manifestBytes }, ...payload]),
  );
  return kbt;
}

export async function buildTool(request: BuildRequest): Promise<string> {
  const toolDir = path.resolve(request.toolDir);
  const pkg = readToolPackage(toolDir);
  const workDir = path.join(path.resolve(request.outDir), 'build', pkg.tool.id);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const { hbc } = await compileBundle(toolDir, pkg, workDir);
  const payload: ZipEntry[] = [
    { name: BUNDLE_ENTRY, data: hbc },
    ...assetFiles(toolDir).map((name) => ({
      name,
      data: readFileSync(path.join(toolDir, name)),
    })),
  ];
  return packKbt(
    request.outDir,
    manifestFor(request, pkg, listFiles(payload), hbc),
    payload,
  );
}
