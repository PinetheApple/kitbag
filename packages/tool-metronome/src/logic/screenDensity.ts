export type ScreenDensity = 'roomy' | 'compact';

export interface DensityInputs {
  readonly windowHeight: number;
  readonly compactBelowHeight: number;
  readonly overflowedWhenRoomy: boolean;
}

export function screenDensity(inputs: DensityInputs): ScreenDensity {
  if (inputs.overflowedWhenRoomy) return 'compact';
  return inputs.windowHeight < inputs.compactBelowHeight ? 'compact' : 'roomy';
}
