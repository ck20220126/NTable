import { readFile, readdir, writeFile } from 'node:fs/promises';
// CSS is a separate public export, not a type dependency.
// TypeScript emits module specifiers in `from` clauses and import type expressions.
// Keep declaration formatting intact while making these paths valid Node ESM paths.
function esmSpecifiers(text) {
  return text.replace(/(\bfrom\s+|\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g,
    (match, prefix, quote, path) => /\.[cm]?js$/.test(path) ? match : `${prefix}${quote}${path}.js${quote}`);
}
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await visit(url);
    else if (entry.name.endsWith('.d.ts')) {
      const text = await readFile(url, 'utf8');
      await writeFile(url, esmSpecifiers(text.replace(/^import\s+["'][^"']+\.css["'];?\s*$/gm, '')));
    }
  }
}
await visit(new URL('../dist/lib/types/', import.meta.url));
