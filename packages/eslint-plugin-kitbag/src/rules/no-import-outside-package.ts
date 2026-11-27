import path from 'node:path';

import type { TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule.ts';

const PACKAGES_MARKER = '/packages/';
const RELATIVE_PREFIX = '.';

type MessageIds = 'outsidePackage';
type SourcedNode =
  | TSESTree.ExportAllDeclaration
  | TSESTree.ExportNamedDeclaration
  | TSESTree.ImportDeclaration;

function toPosix(filename: string): string {
  return filename.replaceAll('\\', '/');
}

function packageRoot(filename: string): string | undefined {
  const posix = toPosix(filename);
  const at = posix.lastIndexOf(PACKAGES_MARKER);
  if (at === -1) return undefined;
  const start = at + PACKAGES_MARKER.length;
  const [name = ''] = posix.slice(start).split('/');
  return posix.slice(0, start) + name;
}

function staysInPackage(filename: string, specifier: string): boolean {
  const root = packageRoot(filename);
  if (root === undefined || !specifier.startsWith(RELATIVE_PREFIX)) return true;
  const target = path.posix.resolve(
    path.posix.dirname(toPosix(filename)),
    specifier,
  );
  return target === root || target.startsWith(`${root}/`);
}

export const noImportOutsidePackage = createRule<[], MessageIds>({
  name: 'no-import-outside-package',
  meta: {
    defaultOptions: [],
    type: 'problem',
    docs: {
      description:
        'A relative import stays inside its own packages/<name>/ directory (SPEC §13.1).',
    },
    schema: [],
    messages: {
      outsidePackage:
        "'{{source}}' resolves outside this package. A downloadable tool " +
        'reaches the rest of the app only through ToolHost (SPEC §13.1, §9.1).',
    },
  },
  create(context) {
    const check = (node: SourcedNode): void => {
      const source = node.source?.value;
      if (source === undefined || staysInPackage(context.filename, source)) {
        return;
      }
      context.report({
        node: node.source ?? node,
        messageId: 'outsidePackage',
        data: { source },
      });
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
});
