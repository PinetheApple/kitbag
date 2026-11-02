import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname, join } from 'node:path';
import { fontFaces } from '@kitbag/core-design';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ENTRY = join(import.meta.dirname, 'designFonts.ts');
const FONT_EXTENSION = '.ttf';
const FONT_PACKAGE_SCOPE = '@expo-google-fonts/';

function followed(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith(FONT_PACKAGE_SCOPE);
}

function runtimeSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function bundledFonts(entry: string): Set<string> {
  const fonts = new Set<string>();
  const seen = new Set<string>();
  const pending = [entry];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    const resolve = createRequire(file).resolve;
    for (const specifier of runtimeSpecifiers(file).filter(followed)) {
      const target = resolve(specifier);
      if (extname(target) === FONT_EXTENSION) {
        fonts.add(basename(target, FONT_EXTENSION));
      } else if (extname(target) !== '.json') {
        pending.push(target);
      }
    }
  }
  return fonts;
}

describe('designFonts', () => {
  it('pulls in exactly the font files fontFaces declares', () => {
    const declared = Object.values(fontFaces).flatMap((faces) =>
      Object.values(faces),
    );
    expect([...bundledFonts(ENTRY)].sort()).toEqual(declared.sort());
  });
});
