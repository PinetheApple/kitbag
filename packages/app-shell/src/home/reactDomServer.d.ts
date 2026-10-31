// react-dom ships without its type package here; ArrangeSheet.test.ts needs only this.
declare module 'react-dom/server' {
  import type { ReactElement } from 'react';

  export function renderToStaticMarkup(element: ReactElement): string;
}
