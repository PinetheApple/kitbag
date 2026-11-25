export interface ScreenInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface ScreenFrameInsets {
  readonly paddingTop: number;
  readonly paddingBottom: number;
}

export interface ScreenFrameOptions {
  readonly dockBelow?: boolean;
}

export function screenFrameInsets(
  insets: ScreenInsets,
  { dockBelow = false }: ScreenFrameOptions = {},
): ScreenFrameInsets {
  return {
    paddingTop: insets.top,
    paddingBottom: dockBelow ? 0 : insets.bottom,
  };
}
