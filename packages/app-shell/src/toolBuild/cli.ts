import { parseArgs } from 'node:util';

import { buildTool } from './buildTool.ts';
import { BuildError } from './paths.ts';
import { gateToolSet } from './toolGate.ts';
import {
  sealBundles,
  stampManifests,
  writeIndex,
  type HostRelease,
} from './toolSet.ts';

const EXIT_FAILED = 1;

const OPTIONS = {
  out: { type: 'string' },
  work: { type: 'string' },
  keys: { type: 'string' },
  'key-id': { type: 'string' },
  'host-version': { type: 'string' },
  'host-version-code': { type: 'string' },
  release: { type: 'boolean', default: false },
} as const;

type Values = ReturnType<
  typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>
>['values'];

function required(
  values: Values,
  name: Exclude<keyof typeof OPTIONS, 'release'>,
): string {
  const value = values[name];
  if (value === undefined || value === '')
    throw new BuildError(`--${name} is required`);
  return value;
}

function host(values: Values): HostRelease {
  return {
    versionName: required(values, 'host-version'),
    versionCode: Number(required(values, 'host-version-code')),
  };
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: OPTIONS,
    allowPositionals: true,
  });
  const [command, dir] = positionals;
  if (dir === undefined)
    throw new BuildError('usage: cli.ts <command> [options] <dir>');
  switch (command) {
    case 'build': {
      const { versionName, versionCode } = host(values);
      console.log(
        await buildTool({
          toolDir: dir,
          outDir: required(values, 'out'),
          hostVersion: versionName,
          hostVersionCode: versionCode,
        }),
      );
      return;
    }
    case 'stamp':
      stampManifests(dir, required(values, 'key-id'), required(values, 'work'));
      return;
    case 'seal':
      sealBundles(dir, required(values, 'work'));
      writeIndex(dir, required(values, 'key-id'), host(values));
      return;
    case 'gate': {
      const problems = gateToolSet({
        dir,
        keysFile: required(values, 'keys'),
        host: host(values),
        release: values.release,
      });
      for (const problem of problems) console.error(problem);
      if (problems.length > 0) process.exitCode = EXIT_FAILED;
      return;
    }
    default:
      throw new BuildError(`unknown command ${String(command)}`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = EXIT_FAILED;
});
