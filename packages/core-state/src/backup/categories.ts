import { CATEGORIES, type Category, type ImportMode } from '@kitbag/core-db';

export const REPLACE_CONFIRMATION = 'replace';

type Selection = readonly Category[];

function ordered(selected: ReadonlySet<Category>, inFile: Selection) {
  return CATEGORIES.filter(
    (category) => selected.has(category) && inFile.includes(category),
  );
}

function linked(
  mode: ImportMode,
  category: Category,
  adding: boolean,
): Category | null {
  if (category === 'setlists' && adding) return 'songPresets';
  if (category === 'songPresets' && !adding) return 'setlists';
  if (mode === 'replace' && category === 'songPresets') return 'setlists';
  if (mode === 'replace' && category === 'setlists') return 'songPresets';
  return null;
}

export function toggledCategories(
  current: Selection,
  category: Category,
  mode: ImportMode,
  inFile: Selection,
): Category[] {
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
): Category[] {
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
