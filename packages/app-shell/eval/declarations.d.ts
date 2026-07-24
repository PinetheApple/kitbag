// eslint-plugin-boundaries ships no type declarations. It is consumed here only
// as an ESLint plugin object handed straight to the flat config, so a minimal
// ambient declaration is enough — no behaviour is retyped (SPEC §13.7).
declare module 'eslint-plugin-boundaries' {
  import type { ESLint } from 'eslint';

  const plugin: ESLint.Plugin;
  export default plugin;
}
