export function rowLabel(title: string, subtitle?: string): string {
  return subtitle === undefined ? title : `${title}, ${subtitle}`;
}
