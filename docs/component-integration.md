# NTable 业务接入文档

本文对应 `app/src/ntable/index.ts` 当前导出的 TSX 组件。当前是源码组件，尚未发布 npm 包；业务系统需集成源码与样式。组件不请求业务接口，数据加载、持久化、权限和记录编辑由业务系统负责。

新增 / 编辑记录页面不属于导出的组件库。预览中的 `App.tsx` 和其中的 `RecordEditor` 仅演示业务接入，不应复制进组件库或作为库入口。业务系统通过 `onAddRecord`、`onAddSubRecord`、`onOpenRecord` 打开自己的页面或表单，保存后更新传入的 rows。

## 运行环境与依赖

- 当前验证环境：React / React DOM 19.2、TypeScript、支持 TSX 的构建工具。
- 组件直接依赖：`@radix-ui/react-checkbox`、`@radix-ui/react-popover`、`@dnd-kit/react`、`@tanstack/react-virtual`、`lucide-react`。已验证版本以 `app/package.json` 和锁文件为准。
- 在浏览器中运行，使用 DOM、ResizeObserver、Pointer Events 和 requestAnimationFrame；交互涉及 `crypto.randomUUID()`，部署使用 HTTPS 或 localhost。
- 容器必须有明确高度，并允许内部滚动；推荐布局为 `height: 600px; min-height: 0; min-width: 0`。

复制 `app/src/ntable/`，并引入 `app/src/styles.css` 后再引入 `app/src/overrides.css`。注意：当前样式含 `body`、`#root`、`.app-shell` 等演示页面全局规则，直接引入会影响业务页面。正式嵌入前需将组件规则和主题变量提取至组件样式文件，移除演示页面规则并限制作用域。当前源码尚未提供隔离的 CSS 包，也未验证多个实例的样式隔离。

## 整体接入

```tsx
import { useState } from "react";
import { NTable, type Field, type TableRecord, type TableView } from "./ntable";

const fields: Field[] = [
  { id: "name", title: "名称", type: "text", width: 220 },
  { id: "status", title: "状态", type: "singleSelect", options: [
    { value: "todo", label: "待处理", color: "#e8efff" },
    { value: "done", label: "已完成", color: "#d9f4e8" },
  ] },
  { id: "date", title: "日期", type: "date" },
];
const rows: TableRecord[] = [
  { id: "r1", name: "主任务", status: "todo", date: "2026-10-01",
    defaultExpanded: true,
    children: [{ id: "r1-1", name: "子任务", status: "done", date: "2026-10-02" }],
  },
];
const initialView: TableView = {
  id: "all", name: "全部记录",
  visibleFieldIds: ["name", "status", "date"],
  columnOrder: ["name", "status", "date"],
  columnWidths: {}, frozenFieldCount: 0, filters: [], sorts: [],
};

export function BusinessTable() {
  const [views, setViews] = useState<TableView[]>([initialView]);
  const [activeId, setActiveId] = useState(initialView.id);
  const activeView = views.find(view => view.id === activeId) ?? views[0];

  const updateView = (id: string, patch: Partial<TableView>) => {
    setViews(current => current.map(view => view.id === id ? { ...view, ...patch } : view));
    // 在此异步保存 patch；失败时由业务层提示并回滚或重试。
  };
  const createView = (name: string) => {
    const view: TableView = { ...initialView, id: crypto.randomUUID(), name };
    setViews(current => [...current, view]);
    setActiveId(view.id);
    // 在此保存新视图。
  };
  const deleteView = (id: string) => {
    const remaining = views.filter(view => view.id !== id);
    if (!remaining.length) return;
    setViews(remaining);
    if (id === activeId) setActiveId(remaining[0].id);
    // 在此删除服务端视图。
  };

  return <div style={{ height: 600, minHeight: 0, minWidth: 0 }}>
    <NTable fields={fields} rows={rows} views={views} activeView={activeView}
      onActiveViewChange={setActiveId} onUpdateView={updateView}
      onCreateView={createView} onDeleteView={deleteView}
      onAddRecord={() => console.log("打开业务新增表单")}
      onAddSubRecord={parent => console.log("新增子记录", parent.id)}
      onOpenRecord={record => console.log("打开业务记录详情", record.id)} />
  </div>;
}
```

示例仅使用内存状态。接入真实接口时替换注释位置；组件不会自动保存，也不会自动生成记录编辑器。

## 独立组合

三个主体分别位于 `ViewBar.tsx`、`TableToolbar.tsx`、`Table.tsx`，可从统一入口按需导入。`NTable.tsx` 仅组合它们并维护搜索词。

```tsx
import { ViewBar, TableToolbar, Table } from "./ntable";

// 放在业务组件内；views、activeView、回调与上例一致。
const [search, setSearch] = useState("");

return <section style={{ height: 600, display: "grid",
  gridTemplateRows: "42px 42px minmax(0, 1fr)" }}>
  <ViewBar views={views} activeView={activeView}
    onActiveViewChange={setActiveId} onCreateView={createView} onDeleteView={deleteView} />
  <TableToolbar fields={fields} activeView={activeView} onUpdateView={updateView}
    search={search} onSearchChange={setSearch} onAddRecord={openCreateForm} />
  <Table fields={fields} rows={rows} activeView={activeView} onUpdateView={updateView}
    search={search} onOpenRecord={openDetail} />
</section>;
```

独立组合时，工具栏与表格必须共享同一个搜索词和受控视图状态。可以省略视图栏或工具栏，仅使用 `Table`。字段配置、筛选、排序面板分别有独立源码文件，但目前未作为稳定公共 API 从统一入口导出。

## 数据结构要求

| 结构 | 要求 |
| --- | --- |
| `Field.id` | 字段唯一标识，与记录属性名、视图中的字段 ID 一致；不得使用记录保留属性 `id`、`children`、`defaultExpanded` |
| `Field.type` | 仅支持 `text`、`singleSelect`、`multiSelect`、`date` |
| `Field.width` | 默认列宽，未指定时为 140px；交互调整范围为 88–1200px，外部输入也应限制在此范围 |
| `Field.options` | 选择字段的值、显示文本和可选颜色；单选值必须能匹配 option.value |
| `Field.searchable` | 默认可搜索，设置 `false` 排除该字段 |
| `TableRecord.id` | 所有层级全局唯一且稳定，用于选择、展开和虚拟行 key |
| 记录字段值 | 文本、日期建议传显示字符串；单选传 option.value；多选传字符串数组 |
| `children` | 可选递归子记录数组；无环结构，避免过深层级 |
| `defaultExpanded` | 初次挂载时默认展开；后续修改该值不会直接控制已挂载组件的展开状态 |
| `TableView.id` | 唯一且稳定；activeView 必须属于 views，views 至少包含一个视图 |
| `visibleFieldIds` | 至少一个有效字段 ID |
| `columnOrder` | 包含所有字段 ID，各出现一次；隐藏字段仍保留在顺序中 |
| `columnWidths` | 以字段 ID 为 key 的宽度映射，优先于 Field.width |
| `frozenFieldCount` | 冻结当前可见列从左起的数量，不包含行号列；范围为 0 到可见列数减 1，最后一列不能被冻结 |
| `filters` / `sorts` | 必须传数组，无规则时传 `[]` |

`date` 当前按传入内容展示，没有日期解析、格式化或编辑功能。多选当前使用统一标签样式，尚未应用每个 option 的颜色。

## Props 与事件

项目按钮统一使用通用 Button，API 和示例见 [Button 文档](./button.md)。复制表格源码时同时复制 `app/src/components/`。

完整类型见 `app/src/ntable/types.ts`。

| Prop / 回调 | 适用组件 | 说明 |
| --- | --- | --- |
| fields、activeView、onUpdateView | NTable、TableToolbar、Table | 必填；字段 schema、当前视图和视图更新 |
| rows、onOpenRecord | NTable、Table | 必填；原始树形记录；双击回调接收原始记录 |
| views、onActiveViewChange、onCreateView | NTable、ViewBar | 必填；切换传 view.id，创建传视图名称 |
| onDeleteView | NTable、ViewBar | 可选，接收 view.id；业务层负责删除和选择剩余视图 |
| onAddRecord | NTable、TableToolbar | 可选；点击新增触发，业务层负责表单及保存 |
| onAddSubRecord | NTable、Table | 可选；接收父记录；保存后业务层将新记录放入对应子数组 |
| getCellProps | NTable、Table | 可选；`(row, field) => { className?, style? }`，为数据单元格定制样式；冻结定位等内部必要样式优先生效 |
| getSubRows | NTable、Table | 可选；默认读取 row.children；返回子记录数组 |
| search、onSearchChange | TableToolbar | 可选受控搜索；关闭搜索会回调空字符串 |
| search | Table | 可选搜索词，默认空字符串 |

视图更新回调签名是 `(id, patch)`，业务层应浅合并 patch 到目标视图。patch 内的数组和 `columnWidths` 是替换值，不是单项增量。拖列排序、字段显隐、冻结、列宽、筛选和排序均通过此回调更新。

## 查询和接口约定

组件没有固定 URL、HTTP 方法或响应格式。业务系统将接口结果转换为上述结构即可。

- 当前筛选、排序、搜索在客户端对传入 rows 执行。仅传一页数据时，结果和记录总数都只针对这一页；尚未提供服务端分页、远程查询或独立 total 参数。
- 筛选为规则之间 AND。支持 `contains`（忽略大小写）、`equals`、`notEquals`；值按字符串比较。空 value 不生效；尚未支持 OR、日期范围、空值条件或多选集合匹配。
- 排序按规则顺序，用中文 locale 和 numeric 字符串比较；`direction` 使用 `asc` / `desc`，树形记录按同级排序。
- 搜索只检查当前可见且 searchable 不为 false 的字段。子记录命中时保留祖先；父记录命中时保留其子树。
- 视图切换回调不返回 Promise；组件内部加载提示仅用于本地视图计算，不代表业务接口请求完成。远程请求的 loading、错误提示和竞态处理需由业务层实现。
- 推荐收到交互后立即更新受控 state，再后台保存；保存失败需业务层恢复此前状态或重试。传入新数组 / 对象，避免原地修改，否则缓存或 memo 可能无法识别更新。

## 当前边界

- 选择、展开、搜索和列高亮是组件内部状态；没有公开受控选择接口或选中记录回调。独立组合时只有搜索由父组件共享。
- 当前切换视图会重置滚动位置及选择，不提供按视图保存滚动位置的公共接口。
- 视图菜单当前仅内置“删除视图”，尚未支持可配置 actions 或菜单权限 API。不传删除回调不会自动隐藏菜单项；若业务需要这些能力，应先扩展 ViewBar。
- 组件不做字段增删、字段类型编辑、单元格内联编辑或业务权限校验。
- 业务系统负责新增 / 编辑 / 删除记录、数据加载、视图持久化、失败反馈及访问控制。
- 当前包含全局样式和部分 any 类型，是可用的源码实现，尚不是封装完成的独立组件库；正式上线前应完成样式隔离、权限行为及业务场景验证。

## 接入验收

1. 校验字段 ID、记录 ID、视图引用及非空数组约束。
2. 确认容器高度、滚动、主题变量、浮层层级，以及业务页面是否受全局 CSS 影响。
3. 验证切换、显隐、拖列、列宽、冻结、筛选、排序，并检查后台保存成功 / 失败分支。
4. 验证父子记录的搜索、展开、新增及详情回调。
5. 验证真实数据量、长文本、多选、空值，以及受控数据异步更新。
