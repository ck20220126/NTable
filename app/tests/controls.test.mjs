import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { build } = viteRequire('esbuild');

const entry = `
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ViewBar } from './src/ntable/ViewBar';
import { TableToolbar } from './src/ntable/TableToolbar';
const view = {id:'v', name:'全部', visibleFieldIds:['name'], columnOrder:['name'], filters:[], sorts:[]};
const props = {views:[view, {...view, id:'v2'}], activeView:view, fields:[{id:'name', title:'名称', type:'text'}], onActiveViewChange(){}, onUpdateView(){}, onCreateView(){}};
export function render(actions, deletable, extra = {}) {
  const currentView = {...view, deletable, ...extra.view};
  const callbacks = {...(actions ? {onDeleteView(){}, onAddRecord(){}, onSearchChange(){}} : {}), ...extra.props};
  return renderToStaticMarkup(createElement('form', null, createElement(ViewBar, {...props, ...callbacks, views:[currentView, {...view, id:"v2"}], activeView:currentView}), createElement(TableToolbar, {...props, ...callbacks})));
}`;
const built = await build({ stdin: {contents: entry, resolveDir: process.cwd(), loader:'ts'}, bundle:true, write:false, platform:'node', format:'cjs', loader:{'.css':'empty'} });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, compiled, compiled.exports);
const { render } = compiled.exports;

test('optional action callbacks control the available actions', () => {
  const readOnly = render(false);
  assert.doesNotMatch(readOnly, /添加记录|全部菜单|aria-label="搜索"/);
  const enabled = render(true);
  assert.match(enabled, /添加记录/);
  assert.match(enabled, /全部菜单/);
  assert.match(enabled, /aria-label="搜索"/);
});

test('table controls embedded in a form do not default to submit', () => {
  const buttons = render(true).match(/<button\b[^>]*>/g);
  assert.ok(buttons.length > 0);
  assert.ok(buttons.every(button => /type="button"/.test(button)));
});


// These panels share the same sibling list and remount whenever their view changes.
test('toolbar panels have unique keys within each view', async () => {
  const source = await readFile(new URL('../src/ntable/TableToolbar.tsx', import.meta.url), 'utf8');
  const prefixes = [...source.matchAll(/<(?:FieldConfigPanel|FilterPanel|SortPanel) key=\{`([^:]+):\$\{activeView\.id\}`\}/g)].map(match => match[1]);
  assert.equal(prefixes.length, 3);
  assert.equal(new Set(prefixes).size, 3);
});

test("protected views hide deletion without preventing view navigation", () => {
  const protectedView = render(true, false);
  assert.doesNotMatch(protectedView, /全部菜单/);
  const activeLabel = protectedView.match(/<button\b[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  assert.equal(activeLabel?.replace(/<[^>]*>/g, ""), "全部");
  assert.match(protectedView, /新建视图/);
  assert.match(render(true, true), /全部菜单/);
  assert.match(render(true), /全部菜单/);
});

test("view management is opt-in and keeps the view menu when deletion is hidden", () => {
  assert.doesNotMatch(render(false), /全部菜单/);
  assert.match(render(false, undefined, {props: {viewManagement: true}}), /全部菜单/);
  assert.match(render(true, false, {props: {viewManagement: true}}), /全部菜单/);
  assert.doesNotMatch(render(true, false, {props: {viewManagement: true}, view: {manageable: false}}), /全部菜单/);
});

test("view menu lists management above deletion and both panels share the visibility control", async () => {
  const source = await readFile(new URL('../src/ntable/ViewBar.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('>视图管理</button>') > 0 && source.indexOf('>视图管理</button>') < source.indexOf('>删除视图<'));
  assert.equal(source.match(/<VisibilityControl /g)?.length, 2);
  assert.match(source, /onCreateView\(newViewName\.trim\(\), \{ visibility: newViewVisibility \}\)/);
});

test("view tab reordering is opt-in and keeps tab markup and navigation", () => {
  const fixed = render(true);
  const sortable = render(true, undefined, {props: {onReorderViews(){}}});
  // 拖拽只挂在已有的标签外层上，不额外加按钮或改动标签内容
  assert.equal(sortable.match(/class="view-tab-wrap/g)?.length, fixed.match(/class="view-tab-wrap/g)?.length);
  assert.match(sortable, /<button\b[^>]*aria-pressed="true"[^>]*>/);
  assert.match(sortable, /全部菜单/);
});

test("view tab dragging uses pointer only and never starts from the view menu button", async () => {
  const source = await readFile(new URL('../src/ntable/ViewBar.tsx', import.meta.url), 'utf8');
  assert.match(source, /sensors=\{VIEW_TAB_SENSORS\}/);
  assert.match(source, /const VIEW_TAB_SENSORS = \[PointerSensor\.configure\(/);
  assert.match(source, /closest\("\.view-menu-button"\)/);
});

test("find shortcut is opt-in, yields to modal dialogs, and Escape only blurs the search box", async () => {
  const source = await readFile(new URL('../src/ntable/TableToolbar.tsx', import.meta.url), 'utf8');
  assert.match(source, /captureFindShortcut = false/);
  assert.match(source, /if \(!captureFindShortcut \|\| !searchEnabled\) return;/);
  assert.match(source, /querySelector\('\[aria-modal="true"\]'\)/);
  assert.match(source, /event\.key === "Escape"[^}]*event\.currentTarget\.blur\(\)/);
});
