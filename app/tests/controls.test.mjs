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
export function render(actions, deletable) {
  const currentView = {...view, deletable};
  const callbacks = actions ? {onDeleteView(){}, onAddRecord(){}, onSearchChange(){}} : {};
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
