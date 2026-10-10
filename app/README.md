# @kun/ntable

React 组件库，本地 release 0.1.0，尚未公开发布。宿主提供 React / React DOM 19.2，并设置明确高度的容器。

从交付的本地包安装，不要把包名当作公共 npm 上已发布的包。将下面路径替换为实际收到的文件：

```sh
npm install ./kun-ntable-0.1.0.tgz
```

宿主项目需已安装 React 和 React DOM 19.2；两者必须各自解析到同一实例。组件使用 ESM，并需要浏览器 DOM、ResizeObserver、Pointer Events、requestAnimationFrame 和 crypto.randomUUID，因此运行在 HTTPS 或 localhost。

最小受控接入：

```tsx
import { useState } from 'react';
import { NTable, type Field, type TableRecord, type TableView } from '@kun/ntable';
import '@kun/ntable/style.css';

const fields: Field[] = [{ id: 'name', title: '名称', type: 'text' }];
const rows: TableRecord[] = [{ id: 'record-1', name: '示例记录' }];
const initial: TableView = {
  id: 'all', name: '全部', deletable: false,
  visibleFieldIds: ['name'], columnOrder: ['name'], filters: [], sorts: [],
};

export function Example() {
  const [views, setViews] = useState<TableView[]>([initial]);
  const [activeId, setActiveId] = useState(initial.id);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const activeView = views.find(view => view.id === activeId) ?? views[0];
  if (!activeView) return null;

  return <>
    <div style={{ height: 420, minWidth: 0 }}>
      <NTable fields={fields} rows={rows} views={views} activeView={activeView}
        onActiveViewChange={setActiveId}
        onUpdateView={(id, patch) => setViews(current => current.map(view =>
          view.id === id ? { ...view, ...patch } : view))}
        onCreateView={name => {
          const view = { ...initial, id: crypto.randomUUID(), name };
          setViews(current => [...current, view]);
          setActiveId(view.id);
        }}
        onOpenRecord={row => setOpenedId(row.id)} />
    </div>
    <output>打开记录：{openedId ?? '未打开'}</output>
  </>;
}
```

每个记录 ID 和视图 ID 必须唯一且稳定。`onUpdateView` 的 patch 应合并到对应视图；示例只更新本地状态，业务系统还需处理后台持久化、失败反馈及权限。`onOpenRecord` 由宿主打开记录详情，组件没有内置编辑器。请求状态通过 `loading`、`error`、`onRetry` 接入；刷新时保留已有 rows 可保持记录可操作。

NTable 提供受控视图、筛选、排序、搜索、列操作与层级记录；数据加载、持久化、权限与编辑页面由宿主实现。字段类型为 text、number、singleSelect、multiSelect、date，层级记录使用 children。CSS 限于 `.ntable`、`.ntable-scope`、`.ntable-portal`。也可从公共入口导入 ViewBar、TableToolbar、Table 进行独立组合，并用 `.ntable-scope` 包裹共享控件。不要导入内部源码路径。

源码工作区执行 `npm run verify` 和 `npm pack --dry-run`。更完整的接入说明、业务接口示例与当前验收范围位于源码仓库的 `docs/component-integration.md`、`docs/business-api-contract.md` 和 `docs/delivery-readiness-2026-10-08.md`；这些仓库文档不包含在 npm 包内，团队交付时应一并提供。公共类型声明随包提供。
