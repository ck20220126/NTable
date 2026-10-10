/** Exercises React's Enter handler; this is not an OS candidate-window test. */
export async function checkViewCreation(root: HTMLElement, created: () => string[]) {
  const wait = () => new Promise(resolve => setTimeout(resolve, 30));
  const results: string[] = [];
  const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); results.push(message); };
  const before = created().length;
  Array.from(root.querySelectorAll('button')).find(button => button.textContent?.includes('新建视图'))!.click();
  await wait();
  const input = document.querySelector<HTMLInputElement>('input[aria-label="视图名称"]')!;
  if (!input) throw new Error('新建视图输入框未打开');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, '中文视图');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '中文视图' }));
  await wait();
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', isComposing: true }));
  await wait();
  assert(created().length === before && input.isConnected, '组词 Enter 不创建视图');
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 229 }));
  await wait();
  assert(created().length === before && input.isConnected, '229 输入法兼容事件不创建视图');
  const enter = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
  input.dispatchEvent(enter);
  await wait();
  assert(created().length === before + 1 && created().at(-1) === '中文视图' && !input.isConnected && enter.defaultPrevented, '普通 Enter 创建一次并阻止表单默认提交');
  return results;
}
