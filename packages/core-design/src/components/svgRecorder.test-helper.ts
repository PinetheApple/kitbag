import { createElement, Fragment, type ReactNode } from 'react';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

interface Drawn {
  readonly name: string;
  readonly props: Props;
}

export const drawn: Drawn[] = [];

function recorded(name: string) {
  return function Recorded(props: Props) {
    drawn.push({ name, props });
    return createElement(Fragment, null, props.children);
  };
}

export const svg = {
  default: recorded('Svg'),
  Defs: recorded('Defs'),
  ClipPath: recorded('ClipPath'),
  LinearGradient: recorded('LinearGradient'),
  Stop: recorded('Stop'),
  Path: recorded('Path'),
  Rect: recorded('Rect'),
  Circle: recorded('Circle'),
};

export function drawnAs(name: string): Props[] {
  return drawn.filter((d) => d.name === name).map((d) => d.props);
}

export function live<T>(updater: () => T): { readonly value: T } {
  return {
    get value() {
      return updater();
    },
  };
}

export function liveProps(props: Props | undefined): Record<string, unknown> {
  const animated = props?.animatedProps as { value: object } | undefined;
  if (animated === undefined) throw new Error('no animated props drawn');
  return { ...animated.value };
}
