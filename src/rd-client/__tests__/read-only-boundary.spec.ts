import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('all runtime app fetch calls pass through the audited policy, with no alternate network clients', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directCalls: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '__tests__') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(path) || /\.(test|spec)\.ts$/.test(path)) continue;
      const ast = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          expect(node.moduleSpecifier.text, relative(root, path)).not.toMatch(
            /^(node:)?(http|https|http2|net|tls|child_process)$|^(axios|undici|node-fetch|got)(\/|$)/,
          );
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const name = ts.isIdentifier(expression)
            ? expression.text
            : ts.isPropertyAccessExpression(expression)
              ? expression.name.text
              : '';
          if (['fetch', 'fetcher', 'uploader'].includes(name))
            directCalls.push(relative(root, path));
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  };
  walk(root);
  expect(directCalls).toEqual(['rd-client/rd-fetch.ts']);
});
