# NTable 组件接入文档

本文面向使用组件库的业务开发人员。公共契约以包导出的类型为准，仓库中的来源是 [`types.ts`](../app/src/ntable/types.ts)。字段、记录、视图的完整格式及业务接口适配见 [业务接口契约](./business-api-contract.md)。

NTable 负责表格展示和本地交互；业务系统负责数据加载、状态管理、持久化、权限和新增/详情页面。演示页面的数据、路由、编辑器和存储方式不属于接入要求。

## 1. 安装与导入

当前包名为 `@kun/ntable`，版本为 0.1.1，尚未公开发布。通过团队交付的包文件或工作区依赖接入；不要把包名当作已可从公共 npm 下载的包。

宿主必须提供符合包 `peerDependencies` 的 React 与 React DOM：当前均为 `^19.2.0`。其余运行依赖由包管理器解析，业务无需分别手工引入内部控件。

### 本地联调：pnpm 软链

无需先发布 npm。先在 NTable 的 `app/` 目录安装依赖并生成库产物：

```sh
cd /path/to/NTable/app
pnpm install
pnpm run build:lib
```

再在业务项目根目录执行（替换为本机实际路径）：

```sh
pnpm link /path/to/NTable/app
```

必须链接到包含 `@kun/ntable` 的 package.json 的 `app/`，而非仓库根目录。`pnpm link` 不负责安装目标包的依赖，所以要先完成上一步。导入方式仍使用下方公共入口。

当前包入口指向 `dist/lib`，修改组件源码、样式或公共类型后，需要再次运行 `pnpm run build:lib`；软链本身不会编译源码，也不保证业务开发服务器自动热更新。若消费端仍缓存旧产物，重启其开发服务器。

React 与 React DOM 必须解析到宿主使用的同一份实例。软链目录存在开发依赖时，应核对宿主构建工具的依赖解析；涉及 peer dependencies 的本地接入，pnpm 官方也建议考虑 `file:` 方式。具体链接行为见 [pnpm link 官方说明](https://pnpm.io/cli/link)。

### 交付安装包

提供给没有组件源码的开发者时，由维护者在 `app/` 执行 `pnpm pack` 生成 `.tgz`，业务项目执行 `pnpm add ./kun-ntable-0.1.1.tgz`。软链路径用于本地联调；团队 CI 需要可获取的包文件、工作区源码或私有 registry 依赖。

### 公共导入


```tsx
import { NTable, type NTableProps } from "@kun/ntable";
import "@kun/ntable/style.css";

export function BusinessTable(props: NTableProps) {
  return <div className="business-table-slot"><NTable {...props} /></div>;
}
```

支持 ESM 导入，包包含 TypeScript 类型声明。只使用公共入口和 `style.css`，不依赖内部文件路径。组件在浏览器中运行，需要 DOM、ResizeObserver、Pointer Events 和 requestAnimationFrame；生成规则 ID 使用 `crypto.randomUUID()`，运行环境应为 HTTPS 或 localhost。

## 2. 容器布局

表格需要一个**可计算且有边界的可用高度**，以便内部滚动和虚拟渲染。具体高度由业务页面布局决定，通过宿主容器的 CSS 设置；公共 props 中没有 `height`。

对于已经分配了可用高度的页面区域，可以让表格填满它：

```css
/* 上级布局须已分配高度，例如页面 grid/flex 中的剩余空间。 */
.business-table-slot {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
```

组件至少保留 68px 的记录区（36px 表头 + 一行 32px 记录）。NTable 常规布局约需 168px，带刷新/失败状态时约需 205px；宿主低于该高度时组件内部产生布局滚动，避免记录区归零。建议业务提供更充足的高度；独立 Table 也会在状态栏与最小记录区无法同时容纳时内部滚动。长状态文本可能需要更多空间。

`height: 100%` 依赖上级高度；仅写百分比不能给整条布局链建立高度。业务也可直接用 flex 的 `flex: 1` 或 grid 的 `minmax(0, 1fr)` 分配剩余空间。flex/grid 中间容器保留 `min-height: 0`、`min-width: 0`，避免表格撑大页面。

引入的 CSS 限于 `.ntable`、`.ntable-scope` 和 `.ntable-portal` 作用域，不设置宿主 body 或 root。独立组件和浮层自带作用域标记。宿主样式覆盖时需同时考虑挂载到 portal 的浮层，避免只在业务容器内设置样式而漏掉浮层。

## 3. 受控接入流程

业务加载并适配字段、记录和视图，再将状态及处理函数传入上例的 `BusinessTable`：

1. 将数据适配为 `Field[]`、`TableRecord[]`、`TableView[]`；视图至少一个。
2. 业务维护当前视图 ID，从 `views` 中取得 `activeView` 对象。组件不接收 `activeViewId`。
3. 回调触发时立即更新受控状态，再异步保存；失败提示、重试、回滚和并发控制由业务处理。

宿主在列手势期间改变当前视图、可见列的顺序/宽度、冻结配置或容器宽度时，组件会取消旧手势，避免随后释放提交过期配置。等价视图对象和数组的重建不会取消手势或重置缩放预览。取消采用宿主最新的列宽，并且不触发视图更新回调。

仅更新隐藏列宽不会中断可见列缩放。缩放提交会把当前字段的新宽度合并到宿主最新的 `columnWidths`，保留隐藏字段的并发设置。

列右键菜单提供“隐藏当前列”，仅通过 `onUpdateView` 更新当前视图的 `visibleFieldIds`；字段数据、列序和保存的列宽保留，可在字段配置中重新显示。最后一个有效可见字段不能隐藏。列宽通过拖拽边界或表头键盘操作调整。
4. 新增或编辑记录成功后，以新对象、新数组更新 `rows`；不要原地修改缓存使用的数据。

`onUpdateView` 使用顶层浅合并。以下函数仅说明状态合并，不包含网络保存策略：

```ts
import type { TableView } from "@kun/ntable";

export function mergeViewPatch(
  views: TableView[], id: string, patch: Partial<TableView>,
): TableView[] {
  return views.map(view => view.id === id ? { ...view, ...patch } : view);
}
```

patch 中的数组和 `columnWidths` 是整体替换值。不要把它们作为单项增量递归合并。新增视图由业务生成稳定 ID 并初始化完整配置；删除视图时至少保留一个，并保证 `activeView` 仍有效。

## 4. Props 与回调

| Prop / 回调 | 适用组件 | 说明 |
| --- | --- | --- |
| `fields`、`activeView`、`onUpdateView` | NTable、TableToolbar、Table | 必填；字段 schema、当前视图及 `(id, patch)` 更新回调 |
| `captureFindShortcut` | NTable、TableToolbar | 可选，默认 false。开启后 Cmd/Ctrl+F 不再打开浏览器查找，而是展开并聚焦工具栏搜索框（已展开则选中原搜索词），直接输入即搜索；页面有模态弹窗（`aria-modal="true"`）时不拦截。监听在 window 上，同一页面只给一个表格开启。搜索框里按 Esc 只失去焦点，保留搜索词；失焦时搜索词去掉首尾空白后为空，则收起回搜索按钮；失焦后搜索框回到常规输入框样式（灰色描边、无光晕，悬停加深），聚焦才是蓝色描边加光晕 |
| `rows`、`onOpenRecord` | NTable、Table | 必填；完整记录范围及打开记录回调，参数为原始记录对象和 `{ fieldId }`（从哪个字段打开，行号列为 null） |
| `views`、`onActiveViewChange`、`onCreateView` | NTable、ViewBar | 必填；切换传视图 ID，创建传名称 |
| `onDeleteView` | NTable、ViewBar | 可选，传视图 ID；不传则隐藏删除项，最后一个视图禁止删除；`view.deletable: false` 隐藏该视图删除菜单 |
| `onDuplicateView` | NTable、ViewBar | 可选，传视图 ID；传入后当前视图菜单显示「复制视图」，副本的名称、可视范围和配置由宿主决定，通常创建后切换过去。不传则隐藏 |
| `viewManagement` | NTable、ViewBar | 可选，默认 `false`；为 `true` 时当前视图菜单显示「重命名」：标签文字就地变成输入框（固定可放 10 个字，聚焦并全选），Enter 或失焦保存，Esc 放弃，空名称不保存，以 `onUpdateView(id, { name })` 回传；开启 `viewVisibilityEditable` 时还显示「可见范围」二级菜单（公共视图 / 个人视图），选中即以 `onUpdateView(id, { visibility })` 保存。`view.manageable: false` 隐藏该视图的这两项。菜单顺序为重命名、复制视图、可见范围、删除视图，没有任何一项可用时不显示菜单 |
| `viewVisibilityEditable` | NTable、ViewBar | 可选，默认 `false`；为 `true` 时新建视图面板在名称下方显示「可视范围」（仅自己 / 所有人，新建默认仅自己），新建时以 `onCreateView(name, { visibility })` 回传；视图菜单显示「可见范围」二级菜单。可视范围的存储与权限由宿主负责 |
| `onReorderViews` | NTable、ViewBar | 可选；传入后视图标签可拖拽排序，松手时回传全部视图 id 的新顺序 `(ids: string[]) => void`。不传则标签顺序固定。拖拽只响应指针（移动 5px 或按住 200ms 起拖，单击照常切换），在视图菜单按钮上按下不起拖。顺序存在哪里（本机或服务器）由宿主决定 |
| `onAddRecord` | NTable、TableToolbar | 可选；不传则隐藏添加记录入口 |
| `getSubRows` | NTable、Table | 可选；同步返回子记录数组，默认读取 `row.children`，不用于远程加载 |
| `getCellProps` | NTable、Table | 可选；`(row, field) => { className?, style? }` 或 undefined，定制单元格样式；内部必要的定位样式优先生效 |
| `getRecordMenuItems`、`onRecordMenuAction` | NTable、Table | 可选；右键记录单元格时的宿主菜单。回调收到 `{ row, field, rows }`（勾选列 `field` 为 null）；`rows` 有勾选时为全部仍存在的勾选记录（含筛选隐藏或折叠的记录），没有勾选时为右键所在行。右键保留勾选；生成菜单和执行动作使用相同的目标快照。返回空数组则不打开菜单。点菜单项后调用 `onRecordMenuAction(key, context)`。批量能力、权限和父子记录去重由宿主实现 |
| `renderFooterSummary` | NTable、Table | 可选；`({ matchedRows, matchedCount }) => ReactNode`，替换底部「N 条记录」文字（右侧「已选择 n 条」照常显示）。`matchedRows` 是当前筛选和搜索后保留的顶层记录（子记录命中时父记录也保留），顺序同显示；`matchedCount` 是含子记录在内的保留总数。宿主可据此按自己的口径计数，或放可点击的快捷筛选 |
| `simpleFilterFields` | NTable、TableToolbar | 可选；`{ fieldId, label?, trueLabel?, falseLabel? }[]`。支持文本、单选、多选、布尔字段，其它类型和未知 id 静默忽略；不传或过滤后为空，工具栏与原来完全一致。传入后工具栏左侧依次是「简单 \| 高级」切换、添加记录、简单筛选控件（高级模式下是筛选按钮）、搜索（简单模式下搜索框常驻展开，高级模式下是图标点开），字段配置和排序移到右侧，始终单行（超出横向滚动）。这些控件与「高级」筛选面板编辑同一份 `activeView.filters`：单选写 `equals`、多选写 `contains`（值为选项数组）、布尔写 `equals` 且值为 `["true"]` 或 `["false"]`，文本是「包含」输入框，写 `contains` 且值为字符串。视图里有超出该形状的条件（任意关系、其它字段、同字段多条、非规范运算符等）时，简单模式不显示控件，改为提示「当前条件超出简单筛选：…」，可去高级里查看或清空条件。选项右侧显示数量，数量按「该字段只选这个选项、其余条件和搜索不变」统计，数量为 0 的未选选项隐藏；没有 rows 时不显示数量 |
| `filterUi`、`onFilterUiChange` | NTable、TableToolbar | 可选；`"simple" \| "advanced"`。传 `filterUi` 即受控，宿主可自行持久化；不传时组件内部维护，默认 simple。仅在配置了有效的 `simpleFilterFields` 时有意义 |
| `rows`、`getSubRows` | TableToolbar | 可选；独立组合 TableToolbar 时传入，仅用于简单筛选的选项数量统计，`getSubRows` 默认读 `row.children`，须与 Table 一致 |
| `search`、`onSearchChange` | TableToolbar | 可选；受控搜索，关闭搜索清空搜索词；不传回调则隐藏搜索入口 |
| `search` | Table | 可选；默认空字符串 |
| `searchDebounceMs` | NTable、TableToolbar | 可选；默认 300ms，仅延迟查询提交，输入立即回显。负数按 0、非有限值按 300ms 处理 |
| `searchResetKey` | TableToolbar | 外部清空时递增，取消未提交草稿（即使 search 原本为空） |
| `loading`、`error`、`onRetry` | NTable、Table | 外部请求状态、用户可读错误文字、宿主重试回调。loading 优先于旧 error |
| `onClearQuery` | Table | 无匹配结果时清空搜索和筛选的回调；NTable 已内置该组合操作 |

回调返回类型为 `void`，组件不等待接口请求；请求、取消和错误恢复由宿主处理，组件展示传入的 loading/error 并发出重试意图。记录双击或键盘定位记录后按 Enter 触发 `onOpenRecord`，业务决定打开路由、弹窗或其它详情界面；组件不提供编辑器。子记录在业务详情中创建，保存后更新 `rows`。

搜索由 `onChange` 同步更新输入草稿，停止输入 300ms 后才更新查询。中文输入法 composition 期间不搜索，确认上字后再计时；关闭或手动清空立即清除并取消旧计时。独立组合时 `onSearchChange` 接收已防抖的查询，不是每次按键。搜索匹配可见且 `searchable !== false` 的字段原始值；单选/多选同时匹配选项显示标签，保留原始值查询。筛选和排序继续使用原始值。

宿主移除 `onSearchChange` 时，组件隐藏搜索入口、取消未提交查询并回退到外部 `search`。随后恢复回调不会提交旧草稿。搜索回调的函数身份变化不会取消正常待提交输入。

请求状态：`rows=[] + loading` 显示首次加载；`rows=[] + error` 显示加载失败和可选重试；成功且 rows 为空显示“暂无记录”；有数据但查询不命中显示“没有符合条件的记录”。后台刷新请保留旧 rows，再设 loading/error，组件保留选择与滚动并显示非阻塞提示。`onRetry` 应立即设 loading，结束时由宿主更新 rows/error 并清除 loading；错误文案应先由宿主脱敏。已有视图计算提示与外部请求状态分开。

键盘入口为网格本身（一个 Tab 停靠点），使用方向键、Home/End、Ctrl/Meta+Home/End、PageUp/PageDown 浏览；Space 选择当前行，Shift+上下扩展/收缩选择范围，Ctrl/Meta+A 选择全部当前投影行，Escape 清空选择，Enter 打开记录。首个数据列 Left 收起或返回父记录，Right 展开；查询期间匹配路径保持展开。表头 Enter 打开列菜单，Alt+左右移动列，Shift+左右每次调整 16px 列宽。菜单支持上下/Home/End/Enter/Escape。Tab 离开网格，输入框和弹层保留自己的按键语义。宿主关闭详情时应将焦点归还原网格元素；组件保留记录 ID 和字段 ID，跨虚拟区域不会丢失活动单元格。导航参考 [W3C Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) 与 [Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)。

## 5. 独立组合

公共入口导出 `NTable`、`ViewBar`、`TableToolbar`、`Table` 及其类型。需要自定义布局或控制搜索时，可独立组合；也可以只使用 `Table`。

```tsx
import { useState } from "react";
import { ViewBar, TableToolbar, Table, type NTableProps } from "@kun/ntable";
import "@kun/ntable/style.css";

export function ComposedTable(props: NTableProps) {
  const [search, setSearch] = useState("");
  return <section className="business-table-composition">
    <ViewBar {...props} />
    <TableToolbar {...props} search={search} onSearchChange={setSearch} />
    <Table {...props} search={search} />
  </section>;
}
```

```css
/* 上级须已分配高度；工具行尺寸交由组件样式决定。 */
.business-table-composition {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-height: 0;
  min-width: 0;
}
```

工具栏与表格共享同一个搜索词和受控视图。`Table` 自带数据滚动区域和底部计数。`NTable` 内部管理搜索，不公开受控搜索 prop。筛选、排序面板及内部 Button、Tooltip 不在公共导出中。

## 6. 数据约束与能力边界

详细类型、JSON 和查询行为见 [业务接口契约](./business-api-contract.md)，接入时尤其注意：

- 字段 ID 与记录属性名一致，避开 `id`、`children`、`defaultExpanded`；记录 ID 在所有层级全局唯一且稳定。
- 字段只支持 text、number、singleSelect、multiSelect、date。日期字段传原始值（ISO 时间字符串、`YYYY-MM-DD` 或时间戳），排序按原始值；显示、搜索、文本筛选按格式化后的文字：与当前同年省略年份，时间只到分钟（如 `11/3 00:53`、`2025/1/5 09:04`），纯日期不带时间，解析不了的原样显示。同一规则以 `formatDateValue` 导出，宿主在表格外显示时间可复用。单选传选项 value，多选传 value 数组。
- 单选、多选标签的底色：选项给了 `color` 就用它；没给时按选项在 `options` 里的顺序，从飞书多维表格选项色板的 11 个浅色（红、橙、黄、黄绿、绿、青、天蓝、蓝、洋红、紫、灰）循环分配，一轮用完后用同色 50% 透明度的一轮，再往后两轮交替；不在 `options` 里的值用灰色。颜色只由顺序决定，宿主想固定某个选项的颜色就显式传 `color`。文字色由 CSS `contrast-color()` 按底色自动取黑或白，不支持的浏览器兜底 `#1f2329`。色板与分配函数以 `TAG_COLORS`、`tagColor(index)`、`optionTagColor(options, value)` 导出，宿主自己的界面可以用同一套颜色。
- `activeView` 属于 `views`；`columnOrder` 保留全部字段，`visibleFieldIds` 至少一个有效字段；无筛选/排序传空数组。
- 选择字段的一条筛选条件可多选，`FilterRule.value` 使用 option.value 字符串数组（兼容旧字符串）；正向命中任一选项，反向排除全部已选项，空数组不筛选。普通字段仍使用字符串。宿主保存/校验筛选配置时需保留数组。
- 树形数据同步提供，`defaultExpanded` 只在 Table 首次挂载时读取；异步加载后改变该属性不会主动展开新记录。查询保留祖先链，父节点命中时保留其子树，排序仅作用于同级。
- 筛选、排序、搜索都在浏览器处理传入的记录范围。只传一页数据时结果仅针对该页。当前没有服务端查询、分页、独立 total、窗口占位或按需加载子节点接口；虚拟滚动不减少数据传输和查询计算量。
- number 字段按有限数值排序，正确处理负数、小数和零；空值及无效数字在顺序/倒序中均排在有效数值之后。其他字段采用中文自然字符串顺序；同值保留原顺序，多规则按优先级比较，排序仅作用于同级。
- 选择、展开、列高亮由组件内部管理，没有公开受控选择或选中记录回调。切换视图重置选择和滚动位置，搜索词不随视图保存。
- 不内置业务权限、字段编辑、记录 CRUD、行内单元格编辑、视图存储或网络请求。支持宿主传入 loading/error/onRetry，组件的视图计算提示不代表业务请求状态。
- “此次筛选仅对自己生效”需要业务在保存层实现个人配置隔离；组件提示本身不提供用户身份或存储隔离。

## 7. 业务接入验收

1. 校验真实接口的数据类型、ID 唯一性、有效字段引用及无环树结构。
2. 确认父容器高度链、内部滚动、浮层层级，以及宿主样式是否干扰控件。
3. 验证视图切换、列操作、筛选、排序和搜索，确认后台保存及失败处理。
4. 验证新增/详情流程与保存后的数据更新；异步首次加载应先准备好有效视图再渲染。
5. 验证个人筛选隔离、真实数据量、长文本、空值、多选和数值排序边界。

组件通过构建和自动化测试不代表业务接口、权限、持久化或真实数据量已经验收。

### 保护指定视图

在对应的 `TableView` 上设置 `deletable: false`，例如 `{ ...view, deletable: false }`。`NTable` 和独立 `ViewBar` 均隐藏该视图的删除菜单，不触发 `onDeleteView`；不传或设为 `true` 保持原有行为，最后一个视图仍不可删除。切换、筛选、排序及布局配置不受影响。业务端应在删除回调及服务端同步校验权限，不能将客户端字段视为安全边界。

### 窄容器中的冻结列

`frozenFieldCount` 保存期望冻结数量。容器不足以容纳冻结前缀和首个普通字段时，组件临时减少实际冻结列；宽度恢复后自动恢复。尺寸变化不调用 `onUpdateView`，不会改写宿主保存的视图。单个字段本身比视口更宽时仍需要横向滚动，不能保证整列同时可见。

筛选浮层也根据实际可用宽度调整排布：内容宽度低于400px时，每条条件分为字段/删除和操作符/输入两行，避免输入框被固定宽度选择器挤窄。普通宽度保留单行；键盘顺序和受控条件语义一致。
