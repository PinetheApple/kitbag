import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_SHELL = join(import.meta.dirname, '..', '..');
const LIBRARY = join(
  APP_SHELL,
  '..',
  'core-native/android/src/main/java/com/kitbag/corenative/library',
);
const read = (path: string) => readFileSync(path, 'utf8');

const MANIFEST = read(
  join(APP_SHELL, 'android/app/src/main/AndroidManifest.xml'),
);
const SUPPORTED_AUDIO = read(join(LIBRARY, 'SupportedAudio.kt'));
const DOCUMENT_PICKER = read(join(LIBRARY, 'DocumentPicker.kt'));
const BACKUP_FILES = read(join(LIBRARY, 'BackupFiles.kt'));

const QUOTED = /"([^"]+)"/g;
const FILTER = /<intent-filter>([\s\S]*?)<\/intent-filter>/g;
const ACTION = /<action android:name="android\.intent\.action\.([A-Z_]+)"\/>/g;
const MIME = /android:mimeType="([^"]+)"/g;

const quoted = (text: string) =>
  [...text.matchAll(QUOTED)].map(([, value = '']) => value);

function captured(pattern: RegExp, text: string): string {
  const match = pattern.exec(text);
  if (match?.[1] === undefined) throw new Error(`no ${pattern.source}`);
  return match[1];
}

const audioMimeTypes = quoted(
  captured(/val FAMILIES = listOf\(([\s\S]*?)\n {2}\)/, SUPPORTED_AUDIO),
).filter((value) => value.includes('/'));
const zipMimeTypes = quoted(
  captured(/ZIP_MIME_TYPES = listOf\(([^)]*)\)/, DOCUMENT_PICKER),
);
const jsonMime = captured(/JSON_MIME = "([^"]+)"/, BACKUP_FILES);

function filterMimeTypes(actions: readonly string[]): string[] {
  return [...MANIFEST.matchAll(FILTER)]
    .map(([, body = '']) => body)
    .filter((body) => {
      const named = [...body.matchAll(ACTION)].map(([, action]) => action);
      return (
        named.length === actions.length &&
        actions.every((action) => named.includes(action))
      );
    })
    .flatMap((body) => [...body.matchAll(MIME)].map(([, type = '']) => type));
}

describe('the Open with and Share filters', () => {
  it('reads the native lists it checks against', () => {
    expect(audioMimeTypes.length).toBeGreaterThan(0);
    expect(zipMimeTypes.length).toBeGreaterThan(0);
  });

  it('opens exactly the supported audio types, zips and backups', () => {
    expect(filterMimeTypes(['VIEW']).sort()).toEqual(
      [...audioMimeTypes, ...zipMimeTypes, jsonMime].sort(),
    );
  });

  it('takes shared audio, zips and backups, one or several at a time', () => {
    expect(filterMimeTypes(['SEND', 'SEND_MULTIPLE']).sort()).toEqual(
      ['audio/*', ...zipMimeTypes, jsonMime].sort(),
    );
  });

  it('never claims every file type', () => {
    expect(MANIFEST).not.toContain('android:mimeType="*/*"');
  });
});
