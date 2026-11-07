import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGES = join(import.meta.dirname, '..', '..');
const SHARED_BAR = 'core-design/src/components/AppBar.tsx';
const ICON_MAP = 'core-design/src/icons.ts';

const BAR_USERS = [
  'app-shell/src/home/HomeScreen.tsx',
  'app-shell/src/settings/CalibrationScreen.tsx',
  'app-shell/src/settings/SettingsFrame.tsx',
  'tool-library/src/screen/LibraryScreen.tsx',
  'tool-metronome/src/library/AllSongsScreen.tsx',
  'tool-metronome/src/library/PresetEditorScreen.tsx',
  'tool-metronome/src/library/SetlistDetailScreen.tsx',
  'tool-metronome/src/library/SetlistsScreen.tsx',
  'tool-metronome/src/screen/MetronomeAppBar.tsx',
  'tool-stems/src/screen/StemAppBar.tsx',
  'tool-tuner/src/screen/TunerScreen.tsx',
];

const STATUS_BAR_FRAMES = [
  'app-shell/src/home/HomeScreen.tsx',
  'app-shell/src/settings/CalibrationScreen.tsx',
  'app-shell/src/settings/SettingsFrame.tsx',
  'tool-library/src/screen/LibraryScreen.tsx',
  'tool-metronome/src/library/ScreenFrame.tsx',
  'tool-metronome/src/screen/MetronomeScreen.tsx',
  'tool-stems/src/screen/StemPlayerScreen.tsx',
  'tool-tuner/src/screen/TunerScreen.tsx',
];

const BACK_GLYPH =
  /\b(?:icon|name)(?:=|: ?)(?:"back"|'back'|\{'back'\})|['"](?:chevron|arrow)-left['"]/;
const TOP_PADDING =
  /paddingTop:\s*([^,}\n]*(?:insets\.top|screenInset)[^,}\n]*)/g;

function sources(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const pkg of readdirSync(PACKAGES)) {
    const src = join(PACKAGES, pkg, 'src');
    if (!existsSync(src)) continue;
    for (const entry of readdirSync(src, { recursive: true })) {
      const file = join(src, String(entry));
      if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      found[relative(PACKAGES, file)] = readFileSync(file, 'utf8');
    }
  }
  return found;
}

describe('app bar', () => {
  const files = sources();

  it('is the shared core-design bar on every screen that has one', () => {
    const own = BAR_USERS.filter(
      (file) => !/<AppBar\b/.test(files[file] ?? ''),
    );
    expect(own).toEqual([]);
  });

  it('draws the back chevron in one place only', () => {
    const drawers = Object.keys(files).filter((file) =>
      BACK_GLYPH.test(files[file] ?? ''),
    );
    expect(drawers.sort()).toEqual([SHARED_BAR, ICON_MAP].sort());
  });

  it('leaves native font shrinking to no screen', () => {
    const shrinkers = Object.keys(files).filter((file) =>
      /\badjustsFontSizeToFit\b|\bminimumFontScale\b/.test(files[file] ?? ''),
    );
    expect(shrinkers).toEqual([]);
  });

  it('puts the bar directly under the status bar on every screen with a bar frame', () => {
    const tops = STATUS_BAR_FRAMES.flatMap((file) =>
      [...(files[file] ?? '').matchAll(TOP_PADDING)].map((match) => ({
        file,
        top: match[1]?.trim(),
      })),
    );
    expect(new Set(tops.map((t) => t.file))).toEqual(
      new Set(STATUS_BAR_FRAMES),
    );
    expect(tops.filter((t) => t.top !== 'insets.top')).toEqual([]);
  });
});
