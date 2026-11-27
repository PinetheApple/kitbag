import { evaluateBundle, hbcFileVersion } from '@kitbag/core-native';

import { ASSET_BYTECODE } from './pluginLoader';
import { SPIKE_MARKER } from './registry';

const MISMATCH_ASSET = 'kb_spike_mismatch.hbc';
const BYTECODE_VERSION_PROPERTY = 'Bytecode Version';
const UNAVAILABLE = 'unavailable';

interface HermesGlobal {
  readonly HermesInternal?: {
    readonly getRuntimeProperties?: () => Readonly<Record<string, unknown>>;
  };
}

function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replaceAll('\n', ' | ');
}

function hostBytecodeVersion(): string {
  const properties = (
    globalThis as HermesGlobal
  ).HermesInternal?.getRuntimeProperties?.();
  const version = properties?.[BYTECODE_VERSION_PROPERTY];
  return typeof version === 'number' ? String(version) : UNAVAILABLE;
}

function fileBytecodeVersion(asset: string): string {
  try {
    return String(hbcFileVersion(asset));
  } catch (error) {
    return `error(${messageOf(error)})`;
  }
}

function report(line: string): string {
  const marked = `${SPIKE_MARKER} ${line}`;
  console.log(marked);
  return marked;
}

export function checkHbcVersions(): string {
  return report(
    `hbcVersion host=${hostBytecodeVersion()} file=${fileBytecodeVersion(ASSET_BYTECODE)} mismatchFile=${fileBytecodeVersion(MISMATCH_ASSET)}`,
  );
}

export function checkMismatchedHbc(): string {
  const host = hostBytecodeVersion();
  report(`mismatch start file=${fileBytecodeVersion(MISMATCH_ASSET)}`);
  try {
    evaluateBundle(MISMATCH_ASSET);
    return report(`mismatch host=${host} result=evaluated`);
  } catch (error) {
    return report(`mismatch host=${host} result=${messageOf(error)}`);
  }
}

export function reportAlive(check: string): void {
  report(`${check} alive`);
}
