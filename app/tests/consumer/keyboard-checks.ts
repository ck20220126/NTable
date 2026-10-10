/** Runs on the small, restored tree fixture. */
export async function checkKeyboard(grid: HTMLElement) {
  const wait = () => new Promise(resolve => setTimeout(resolve, 30));
  const active = () => grid.getAttribute('aria-activedescendant')?.split('-cell-')[1];
  const results: string[] = [];
  const key = async (value: string, modifiers: KeyboardEventInit = {}) => {
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers }));
    await wait();
  };
  const assert = (ok: boolean, text: string) => { if (!ok) throw new Error(`${text}; active=${active()}; selected=${grid.querySelectorAll('[aria-selected="true"]').length}`); results.push(text); };
  grid.focus();
  await key('Escape');
  await key('Home', {ctrlKey:true});
  await key('ArrowRight');
  await key('ArrowDown');
  assert(active() === '0-1', '首记录首字段导航');
  const first = grid.querySelector('[data-grid-row="0"]')!;
  if (first.getAttribute('aria-expanded') !== 'true') await key('ArrowRight');
  await key('ArrowLeft');
  assert(first.getAttribute('aria-expanded') === 'false', '左键折叠父行');
  await key('ArrowRight');
  assert(first.getAttribute('aria-expanded') === 'true', '右键展开父行');
  await key('ArrowDown', {shiftKey:true});
  assert(active() === '1-1' && grid.querySelectorAll('[aria-selected="true"]').length === 2, 'Shift 下选择父子两行');
  await key('ArrowDown', {shiftKey:true});
  assert(grid.querySelectorAll('[aria-selected="true"]').length === 3, 'Shift 下扩展至三行');
  await key('ArrowUp', {shiftKey:true});
  assert(grid.querySelectorAll('[aria-selected="true"]').length === 2, '反向移动收缩范围');
  await key('ArrowLeft');
  assert(active() === '0-1', '子行左键回到父行');
  await key('a', {ctrlKey:true});
  assert(grid.querySelectorAll('[aria-selected="true"]').length === 4, '全选包含展开子行');
  await key('Escape');
  assert(grid.querySelectorAll('[aria-selected="true"]').length === 0, 'Escape 清空选择');
  return results;
}
