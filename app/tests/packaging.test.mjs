import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const app = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('vite/package.json'))('postcss');
const manifest = JSON.parse(readFileSync(new URL('package.json', app), 'utf8'));
const read = path => readFileSync(new URL(path, app), 'utf8');

test('release exposes ESM, declarations and opt-in CSS with host React', () => {
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, 'module');
  for (const path of [manifest.exports['.'].import, manifest.exports['.'].types, manifest.exports['./style.css'].default, manifest.exports['./style.css'].types]) {
    assert.ok(existsSync(new URL(path, app)), `missing ${path}`);
  }
  assert.ok(manifest.peerDependencies.react);
  assert.ok(manifest.peerDependencies['react-dom']);
  assert.equal(manifest.dependencies.react, undefined);
  assert.equal(manifest.dependencies['react-dom'], undefined);
  for (const name of ['@tanstack/react-table', '@dnd-kit/helpers', '@radix-ui/react-dialog']) assert.equal(manifest.dependencies[name], undefined);
  assert.ok(manifest.devDependencies['@radix-ui/react-dialog']);
  assert.deepEqual(manifest.sideEffects, ['**/*.css']);
  const esm = read(manifest.exports['.'].import);
  assert.match(esm, /from "react(?:\/jsx-runtime)?"/);
  assert.doesNotMatch(esm, /RecordEditor|app-shell|react\.production|react-dom\/client/);
  for (const name of ['NTable', 'ViewBar', 'TableToolbar', 'Table']) assert.match(esm, new RegExp(`\\bas ${name}\\b`));
});

test('every CSS rule stays within component roots and portals', () => {
  const css = read(manifest.exports['./style.css'].default);
  const root = postcss.parse(css);
  assert.doesNotMatch(css, /\.app-shell|\.editor-layer|:root|#root/);
  assert.match(css, /--blue:/);
  assert.match(css, /\.ntable-portal/);
  assert.match(css, /\.ntable-scope/);
  assert.match(css, /box-sizing:border-box/);
  root.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    for (const selector of rule.selectors) {
      assert.ok(selector.startsWith(':where(.ntable, .ntable-scope, .ntable-portal)'), selector);
      assert.doesNotMatch(selector, /\)(?:button|input|select|\*)/, `invalid compound selector: ${selector}`);
    }
  });
  root.walkAtRules(/keyframes$/, rule => assert.ok(rule.params.startsWith('ntable-')));
});

test('npm pack includes only the library and package documentation', () => {
  const result = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: app, encoding: 'utf8', env: { ...process.env, npm_config_cache: join(tmpdir(), 'ntable-npm-cache') } }))[0];
  const paths = result.files.map(file => file.path);
  assert.ok(paths.includes('dist/lib/index.js'));
  assert.ok(paths.includes('dist/lib/ntable.css'));
  assert.ok(paths.includes('dist/lib/style.d.ts'));
  assert.ok(paths.includes('dist/lib/types/ntable/index.d.ts'));
  assert.ok(paths.every(path => path.startsWith('dist/lib/') || ['package.json', 'README.md'].includes(path)), paths.join('\n'));
  assert.ok(paths.every(path => !/worker|App\.|client\/|\.openai|\.map$/.test(path)));
});

test('npm and pnpm locks match manifest dependency contracts and tested direct versions', () => {
  const npmLock = JSON.parse(read('package-lock.json'));
  assert.equal(npmLock.name, manifest.name);
  assert.equal(npmLock.version, manifest.version);
  for (const category of ['dependencies', 'devDependencies', 'peerDependencies']) {
    assert.deepEqual(npmLock.packages[''][category], manifest[category]);
  }
  const pnpm = read('pnpm-lock.yaml').split('\n');
  let category, name;
  const importer = { dependencies: {}, devDependencies: {} };
  const versions = {};
  for (const line of pnpm) {
    if (line === 'packages:') break;
    const section = line.match(/^    (dependencies|devDependencies):$/);
    if (section) { category = section[1]; continue; }
    const key = line.match(/^      (?:'([^']+)'|([^:]+)):$/);
    if (key) { name = key[1] ?? key[2]; continue; }
    const specifier = line.match(/^        specifier: (.+)$/);
    if (specifier && category && name) importer[category][name] = specifier[1].replace(/^['"]|['"]$/g, '');
    const version = line.match(/^        version: ([^(\s]+)/);
    if (version && name) versions[name] = version[1];
  }
  for (const category of ['dependencies', 'devDependencies']) assert.deepEqual(importer[category], manifest[category]);
  for (const [name, version] of Object.entries(versions)) assert.equal(npmLock.packages[`node_modules/${name}`]?.version, version, name);
});

test('CSS export resolves in a strict consumer without ambient CSS modules', () => {
  assert.equal(read(manifest.exports['./style.css'].types).trim(), 'export {};');
  execFileSync(process.execPath, [join(dirname(require.resolve('typescript/package.json')), require('typescript/package.json').bin.tsc), '--ignoreConfig', '--noEmit', '--strict', '--noUncheckedSideEffectImports', '--skipLibCheck', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--target', 'ES2022', '--types', 'react', 'tests/consumer-css.ts'], { cwd: app, encoding: 'utf8' });
});
