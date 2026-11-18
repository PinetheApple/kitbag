export interface ReaderHiding {
  readonly importantForAccessibility: 'no-hide-descendants' | 'auto';
  readonly accessibilityElementsHidden: boolean;
}

export function readerHiding(hidden: boolean): ReaderHiding {
  return {
    importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto',
    accessibilityElementsHidden: hidden,
  };
}
