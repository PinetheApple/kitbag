import {
  IMPORT_CATEGORIES,
  type ImportCategory,
  type ImportMode,
} from '@kitbag/core-db';

export const REPLACE_CONFIRMATION = 'replace';

type Selection = readonly ImportCategory[];

function ordered(selected: ReadonlySet<ImportCategory>, inFile: Selection) {
  return IMPORT_CATEGORIES.filter(
    (category) => selected.has(category) && inFile.includes(category),
  );
}

function linked(
  mode: ImportMode,
  category: ImportCategory,
  adding: boolean,
): ImportCategory | null {
  if (category === 'setlists' && adding) return 'songPresets';
  if (category === 'songPresets' && !adding) return 'setlists';
  if (mode === 'replace' && category === 'songPresets') return 'setlists';
  if (mode === 'replace' && category === 'setlists') return 'songPresets';
  return null;
}

export function toggledCategories(
  current: Selection,
  category: ImportCategory,
  mode: ImportMode,
  inFile: Selection,
): ImportCategory[] {
  const selected = new Set(current);
  const adding = !selected.has(category);
  const partner = linked(mode, category, adding);
  for (const changed of partner === null ? [category] : [category, partner])
    if (adding) selected.add(changed);
    else selected.delete(changed);
  return ordered(selected, inFile);
}

export function categoriesForMode(
  current: Selection,
  mode: ImportMode,
  inFile: Selection,
): ImportCategory[] {
  const selected = new Set(current);
  if (mode === 'replace' && selected.has('songPresets')) {
    if (inFile.includes('setlists')) selected.add('setlists');
    else selected.delete('songPresets');
  }
  return ordered(selected, inFile);
}

export function isReplaceConfirmed(typed: string): boolean {
  return typed.trim().toLowerCase() === REPLACE_CONFIRMATION;
}
