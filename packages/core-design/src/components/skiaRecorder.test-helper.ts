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

export const skia = {
  Canvas: recorded('Canvas'),
  Group: recorded('Group'),
  Path: recorded('Path'),
  RoundedRect: recorded('RoundedRect'),
  Circle: recorded('Circle'),
};

export function drawnAs(name: keyof typeof skia): Props[] {
  return drawn.filter((d) => d.name === name).map((d) => d.props);
}

export function derived<T>(updater: () => T): { readonly value: T } {
  return {
    get value() {
      return updater();
    },
  };
}
