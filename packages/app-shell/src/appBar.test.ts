import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGES = join(import.meta.dirname, '..', '..');
const SHARED_BAR = 'core-design/src/components/AppBar.tsx';

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

const BACK_GLYPH = /\b(?:icon|name)=(?:"back"|\{'back'\})|icon: 'back'/;

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
    expect(drawers).toEqual([SHARED_BAR]);
  });

  it('has no full-arrow back left anywhere', () => {
    const arrows = Object.keys(files).filter((file) =>
      /\barrowBack\b|ScreenAppBar/.test(files[file] ?? ''),
    );
    expect(arrows).toEqual([]);
  });
});
