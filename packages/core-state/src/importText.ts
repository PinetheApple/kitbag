export function formatName(format: string): string {
  return format === '' ? 'this format' : format.toUpperCase();
}

export function joinedFormatNames(formats: readonly string[]): string {
  const names = [...formats];
  const last = names.pop();
  if (last === undefined) return '';
  return names.length === 0 ? last : `${names.join(', ')} or ${last}`;
}

export function unsupportedImportText(
  name: string,
  format: string,
  supported: readonly string[],
): string {
  return `Can’t import “${name}”: ${formatName(format)} isn’t supported. Use ${joinedFormatNames(supported)}.`;
}

export const PICKER_FAILED_TEXT =
  'The file picker could not open. Try again in a moment.';
