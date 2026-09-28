# NTable 多视图数据表组件：调研与实现方案

## 1. 产品定位

NTable 不是飞书多维表格的全功能克隆，而是它的严格功能子集。凡是进入范围的能力，都必须在视觉、操作路径、反馈和状态变化上与飞书一致；没有进入范围的能力则完全不出现。它面向“活动元素表维护”等结构化业务场景：

- 一份字段 schema 和一份记录数据；
- 多个可保存的部门视图；
- 每个视图独立保存字段显隐、列顺序、筛选和排序；
- 表格只负责高密度浏览、选择和导航，不承担行内编辑；
- 双击记录后由业务方打开新页面或全屏弹窗编辑；
- 字段类型由外部 schema 定义，表格页面不可修改。

### 交互复刻原则

- **功能可以少，保留功能不能简化。** 添加记录、视图配置、筛选、排序、搜索、新建视图、切换视图和列拖拽均按飞书交互复刻。
- **交互等价，技术实现可不同。** 用户可见行为必须一致，但底层可以使用虚拟化 DOM Grid，而不必使用飞书的 Canvas。
- **同状态同反馈。** Hover、按下、选中、加载、空状态、错误、拖拽、保存中和保存完成都需要对应的视觉反馈。
- **同操作路径。** 不把飞书的浮层改成普通表单页，也不把直接拖拽改成设置页内排序。
- **同持久化语义。** 视图级操作只影响当前视图；数据级操作影响所有视图中的同一条记录。

## 2. 已验证的飞书交互与实现特征

基于当前飞书多维表格页面的实际检查：

1. 页面由“数据表导航 / 视图导航 / 视图工具栏 / 表格画布”四层构成。
2. 表格主体是单个 Canvas，当前页面中画布约为 1287 × 1096 CSS 像素；表头、行号、单元格和空白区域都在同一画布中绘制。
3. 工具栏和视图导航使用 DOM；高频数据区使用 Canvas。这是典型的“DOM 外壳 + Canvas 数据面”结构。
4. 双击普通单元格会进入画布内编辑状态。
5. 双击字段标题会打开字段名称、字段类型和默认值设置浮层。
6. 顶部存在“添加记录”主入口，表格底部还有追加行入口。
7. 视图配置是视图级能力；同一数据表可以通过视图保存不同的展示和整理方式。

NTable 需要复刻第 1、3、7 项的产品结构和视觉密度，但明确移除第 4、5、6 项中的行内编辑、页面内字段配置和尾行添加入口。

## 3. 最终信息架构

```text
NTable
├─ ViewBar
│  ├─ 当前视图 / 视图切换
│  └─ 新建并保存视图
├─ Toolbar
│  ├─ 左：添加记录、视图配置、筛选、排序
│  └─ 右：搜索
├─ VirtualGrid
│  ├─ 表头（拖拽列、调整宽度、排序状态）
│  ├─ 虚拟行与虚拟列
│  └─ 空状态 / 加载状态 / 错误状态
└─ RecordEditorAdapter
   └─ 双击记录 -> 新页面或全屏弹窗
```

不提供：智能提醒、AI、自动化、行高设置、填色、分组、尾行添加、表内字段类型修改、单元格行内编辑。

## 4. 数据模型

字段 schema 与视图配置必须分离。字段 schema 表达“数据是什么”，视图表达“某个部门怎么看”。

```ts
type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'singleSelect'
  | 'multiSelect'
  | 'date'
  | 'datetime'
  | 'url'
  | 'image'
  | 'file'
  | 'reference'
  | 'computed';

interface FieldDefinition<Row> {
  id: string;
  key: keyof Row | string;
  title: string;
  type: FieldType | (string & {});
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  readOnly?: boolean;
  options?: Array<{ value: string; label: string; color?: string }>;
  render?: (value: unknown, row: Row) => React.ReactNode;
  sortAccessor?: (row: Row) => unknown;
}

interface TableView {
  id: string;
  name: string;
  visibleFieldIds: string[];
  columnOrder: string[];
  columnWidths?: Record<string, number>;
  pinnedFieldIds?: string[];
  filters: FilterGroup;
  sorts: Array<{ fieldId: string; direction: 'asc' | 'desc' }>;
  revision: number;
}
```

约束：

- `FieldDefinition.type` 只能由组件外部传入，任何表格 UI 都不能改它。
- `visibleFieldIds` 决定字段是否出现在当前部门视图。
- `columnOrder` 只影响当前视图，不改变 schema，也不影响其他视图。
- 删除字段属于 schema 管理系统的职责，不属于 NTable。
- 建议为视图保存 `revision`，避免多人同时保存时静默覆盖。

## 5. 组件 API

```ts
interface NTableProps<Row> {
  fields: FieldDefinition<Row>[];
  views: TableView[];
  activeViewId: string;
  dataSource: NTableDataSource<Row>;

  onActiveViewChange(viewId: string): void;
  onCreateView(input: CreateViewInput): Promise<TableView>;
  onUpdateView(viewId: string, patch: ViewPatch): Promise<TableView>;

  onAddRecord(): void;
  onOpenRecord(row: Row, mode: 'page' | 'fullscreen'): void;

  editorMode?: 'page' | 'fullscreen';
  permissions?: {
    createView?: boolean;
    updateView?: boolean;
    addRecord?: boolean;
  };
}

interface NTableDataSource<Row> {
  getRows(query: {
    offset: number;
    limit: number;
    filters: FilterGroup;
    sorts: TableView['sorts'];
    search: string;
    signal: AbortSignal;
  }): Promise<{ rows: Row[]; total: number }>;
  getRowId(row: Row): string;
}
```

组件保持 headless data source：本地数组、小型 REST API、GraphQL、数据库分页都可以接入。筛选、排序和搜索默认走服务端，避免把全部业务记录先下载到浏览器。

## 6. 视图行为

### 新建视图

- 点击“新建视图”后输入名称。
- 默认从当前视图复制字段显隐、列顺序、筛选和排序，减少重复配置。
- 保存成功后切换到新视图。
- 部门场景建议使用共享视图；权限由外部 `permissions` 控制。

### 视图配置

- 面板只提供字段搜索、显隐、拖拽排序和可选冻结列。
- 不提供字段类型、颜色、格式、默认值等 schema 编辑。
- 面板中的拖拽顺序与表头拖拽顺序写入同一个 `columnOrder`。
- 未保存修改先在本地预览；保存失败则回滚并保留用户操作提示。

### 搜索

- 搜索范围为当前视图的可见且 `searchable !== false` 的字段。
- 200 ms 防抖，新的请求取消旧请求。
- 搜索词是临时交互状态，默认不写入视图；如业务需要可配置为可保存。

## 7. 列拖拽交互

需要复刻飞书的“表头直接拖拽换位”，但只修改当前视图。

交互规则：

1. 仅从表头主体区域启动拖拽；列宽手柄和排序按钮不能触发拖拽。
2. 指针移动超过 4 px 后进入拖拽，避免普通点击误触。
3. 原表头保留占位；鼠标旁显示半透明拖拽浮层。
4. 目标列左侧或右侧显示 2 px 插入线，根据指针是否越过目标列中点判断位置。
5. 靠近左右边缘时自动水平滚动，速度随距离边缘的接近程度增加。
6. 固定列与非固定列之间默认不可跨区；需要跨区时必须显式解除固定。
7. 松开后乐观更新 `columnOrder`，随后保存视图；失败则回滚。
8. `Escape` 取消；键盘提供“移动列”菜单作为无鼠标替代。

建议使用新版 `@dnd-kit/react` 的 PointerSensor 和 sortable 能力，自行实现表头碰撞检测与横向自动滚动。不要新项目继续使用 legacy `@dnd-kit/core`，也不要使用 HTML5 Drag and Drop：后者的拖拽预览、触屏和自动滚动一致性都较差。

## 8. 飞书交互等价验收矩阵

以下不是“类似即可”，而是逐项对照飞书验收。

| 能力 | 必须复刻的用户行为 | NTable 的范围差异 |
| --- | --- | --- |
| 视图切换 | 顶部视图标签/入口、当前态、切换后表格即时重排、每个视图状态独立 | 只支持表格视图类型 |
| 新建视图 | 从视图区域进入、输入名称、创建后成为当前视图、可再次切换回来 | 不展示看板、日历、甘特等类型 |
| 视图配置 | 浮层式配置；字段列表可搜索、显隐和排序；修改立即反映到表格 | 不允许修改字段类型或字段格式 |
| 添加记录 | 工具栏左侧主按钮；点击进入新增流程；完成后记录出现在当前视图适当位置 | 编辑承载为新页面或全屏弹窗；无尾行添加入口 |
| 筛选 | 工具栏入口、条件行、字段选择、随类型变化的运算符和值控件、条件计数/激活态、清除 | 字段和运算符来自固定 schema |
| 排序 | 工具栏入口、多级排序、字段与升降序、拖动优先级、激活态、清除 | 不提供页面内字段配置 |
| 搜索 | 右侧图标入口、展开/聚焦、实时匹配、命中反馈、清空和退出 | 不显示 AI、提醒等相邻功能 |
| 列拖拽 | 从表头直接拖动、原位占位、跟手浮层、插入指示线、边缘自动滚动、松手生效 | 只保存到当前视图 |
| 列宽调整 | 表头边界 hover 手柄、拖动实时预览、松手保存 | 不提供复杂格式设置 |
| 行选择 | 行 hover、选中背景、首列复选框、全选与部分选中状态 | 不因选择进入行内编辑 |
| 记录打开 | 双击同一行任意普通单元格触发记录详情 | 打开新页面或全屏弹窗，而不是单元格编辑 |
| 加载与空状态 | 表头和工具栏稳定，数据区域呈现加载、无结果或无记录反馈 | 不在空白尾行提供添加按钮 |

### 复刻验证方法

实现期间为每项能力建立“飞书参考状态 → NTable 对应状态”的截图对照：

1. 默认态；
2. hover/按下态；
3. 浮层打开态；
4. 配置完成态；
5. 保存中与失败态；
6. 键盘与焦点态；
7. 窄屏、横向滚动和大数据量状态。

布局、间距、字号、颜色、边框、阴影、动效时长、浮层锚点和点击热区都进入视觉 QA。只有全部通过，才算该功能完成。

## 9. 渲染方案与性能

### 为什么不直接复制 Canvas

Canvas 适合飞书这种包含行内编辑、公式、富文本、多种复杂字段和极大数据量的通用平台，但代价是：文本选择、无障碍语义、焦点管理、单元格测量、自动化测试和自定义渲染都要重建。

NTable 移除了最昂贵的行内编辑和自由样式能力，因此推荐：

- `@tanstack/react-table`：列模型、排序和筛选状态；
- `@tanstack/react-virtual`：行虚拟化和列虚拟化；
- CSS Grid：表头和可见单元格对齐；
- `@dnd-kit/core`：列拖拽；
- React Query 或等价请求层：分页、缓存、取消和预取。

这能保留飞书式高密度体验，同时让每个可见单元格仍是可访问、可测试的 DOM。

### 性能预算

- 首屏只渲染可见行、可见列和少量 overscan，DOM 单元格建议控制在 1,500 个以内。
- 固定行高 36 px；不支持用户自定义行高，避免动态测量开销。
- 横向与纵向都虚拟化；列少于 30 时可关闭列虚拟化以简化拖拽。
- 滚动期间不更新 React 全局状态，滚动偏移交给虚拟化器处理。
- 单元格 renderer 使用稳定引用；按 `rowId + fieldId + valueVersion` memo。
- 筛选、排序和搜索使用服务端执行；请求携带 `AbortSignal`。
- 下一页在距离可见底部约 2 个视口时预取。
- 对连续拖拽只更新本地顺序，拖拽结束后才持久化一次。
- 视图切换优先显示缓存结果，并在后台按 revision 校验。

建议验收基线：

- 100,000 条记录、100 列的服务端数据模型；
- 典型 1440 × 900 视口下稳定 60 fps 滚动，低配设备目标不低于 45 fps；
- 视图切换命中缓存时 100 ms 内可见；
- 列拖拽过程中单帧脚本与布局合计低于 12 ms；
- 搜索输入不因请求或大数据重渲染而掉帧。

## 10. 记录编辑流程

- 单击：选中行，不进入编辑。
- 双击：调用 `onOpenRecord(row, editorMode)`。
- `editorMode='page'`：由路由打开 `/records/:id/edit`。
- `editorMode='fullscreen'`：打开占满视口的 Dialog/Drawer。
- 新增记录复用相同编辑器，只是没有 record id。
- 编辑器保存后仅使对应行缓存失效，不刷新整张表。

## 11. 实施顺序

1. 建立字段 schema、视图模型和 mock data source。
2. 完成虚拟表格、固定表头、选择和双击打开编辑器。
3. 完成视图切换、新建、保存和字段显隐。
4. 完成筛选、排序、右侧搜索及服务端查询协议。
5. 完成表头拖拽、自动滚动、乐观保存和回滚。
6. 用 100k × 100 的生成数据做性能、键盘和可访问性验收。

## 12. 明确的第一版范围

第一版应只做表格视图，不做看板、日历、甘特或表单视图。视图的价值来自“字段显隐 + 列顺序 + 筛选 + 排序”，不是视图类型数量。等活动元素表的部门工作流稳定后，再判断是否需要扩展其他呈现方式。

## 13. 技术方案与脚手架

### 13.1 基础技术栈

| 层级 | 选择 | 用途与原因 |
| --- | --- | --- |
| 语言 | TypeScript strict | 保证字段 schema、筛选运算符和视图配置的类型安全 |
| UI 框架 | React 19 | 组件库和业务应用统一运行时 |
| 包管理 | pnpm workspace | 管理核心组件、演示应用和共享配置 |
| 构建 | Vite + React SWC | 开发 HMR、演示应用和组件库构建 |
| 表格状态 | `@tanstack/react-table` v9 | Headless 列模型、显隐、宽度、排序和受控状态 |
| 虚拟化 | `@tanstack/react-virtual` v3 | 行列双向虚拟化 |
| 拖拽 | `@dnd-kit/react` + `@dnd-kit/helpers` | 新版 Pointer Events、sortable、乐观排序和键盘拖拽 |
| 异步数据 | `@tanstack/react-query` v5 | 分页缓存、取消、预取、乐观更新和失效 |
| 浮层原语 | Radix Primitives | Popover、Dialog、Dropdown、Checkbox、Tooltip 的焦点与键盘基础 |
| 图标 | `lucide-react` | 使用可维护的开源图标，再按飞书尺寸和描边进行视觉校准 |
| 样式 | CSS Modules + CSS Custom Properties | 像素级复刻、主题变量、零 CSS-in-JS 滚动开销 |
| Mock API | MSW | Storybook、单测和演示应用共用同一网络协议 |

版本策略：提交 lockfile，应用依赖锁定精确版本；公共组件的 React、React DOM 设为 peer dependency。不要把 React Query、路由或业务表单库打进 NTable 核心包。

### 13.2 Workspace 结构

```text
ntable/
├─ apps/
│  └─ playground/                 # 可运行演示与性能基准
│     ├─ src/app/
│     ├─ src/mocks/
│     ├─ src/scenarios/           # 8 行、1 万行、10 万行场景
│     └─ src/record-editor/        # 全屏编辑示例
├─ packages/
│  └─ ntable/
│     ├─ src/
│     │  ├─ core/                  # schema、view、query、data source 类型
│     │  ├─ table/                 # NTable、虚拟网格、表头、行与单元格
│     │  ├─ views/                 # 视图切换、新建、保存、配置
│     │  ├─ filters/               # 类型驱动的筛选器注册表
│     │  ├─ sorting/               # 多级排序面板
│     │  ├─ search/                # 搜索展开、输入与命中状态
│     │  ├─ dnd/                   # 列拖拽、碰撞检测、自动滚动
│     │  ├─ primitives/            # 飞书风格按钮、浮层、菜单、复选框
│     │  ├─ styles/                # tokens、主题与组件 CSS Modules
│     │  ├─ adapters/              # array / remote data source 适配器
│     │  └─ index.ts               # 唯一公共导出面
│     ├─ stories/                  # Storybook 状态与截图用例
│     └─ tests/
├─ e2e/                            # Playwright 交互和视觉回归
├─ docs/
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ vite.config.ts
```

核心包不感知业务路由。双击记录只触发 `onOpenRecord`，由宿主应用决定新页面还是全屏 Dialog。

### 13.3 分层与状态所有权

```text
Host application
├─ schema / permissions / active view
├─ REST or GraphQL data source
└─ record editor route or fullscreen dialog
        │ controlled props + callbacks
        ▼
NTable controller
├─ view state: visible fields / order / widths / filters / sorts
├─ transient state: hover / selection / drag / search input
└─ query projection: view + search -> NTableQuery
        │
        ├─ TanStack Table: column and header model
        ├─ TanStack Virtual: visible rows and columns
        ├─ dnd-kit: header order interaction
        └─ React Query adapter: remote pages and mutations
```

- 持久状态由宿主受控：视图、权限、数据和保存回调。
- 高频瞬时状态留在组件内部，且按区域订阅，避免整个表格重渲染。
- 不引入 Zustand 作为公共依赖；如果宿主使用 Zustand/Redux，可通过受控 props 接入。
- 行选择使用 `Set<RowId>`，拖拽中的坐标存 ref，不在每个 pointer move 中 setState。

### 13.4 表格渲染结构

不使用原生 `<table>` 做主体，因为固定列、双向虚拟化和像素级定位会让布局难以控制；使用带 ARIA 语义的 CSS Grid：

```text
div[role=grid]
├─ sticky div[role=row]            # header
│  └─ div[role=columnheader]
└─ virtual canvas-sized spacer
   └─ absolute div[role=row]       # only visible rows
      └─ div[role=gridcell]        # only visible columns
```

关键约束：

- 固定行高 36 px，表头 36 px，避免动态高度测量。
- 左侧选择列和固定业务列单独 sticky，z-index 分层固定。
- 行虚拟化 overscan 默认 8；列虚拟化 overscan 默认 2。
- 可见列少于 30 时关闭列虚拟化，使拖拽与焦点管理更稳定。
- 单元格只接收原始 value、rowId、fieldId 和必要状态，使用 `memo` 隔离更新。
- Hover 使用 CSS；鼠标移动不写 React 状态。
- 表格容器使用 `contain: strict`，行使用 `contain: layout paint`。

### 13.5 字段类型注册表

字段类型不是写死在大组件中的 switch，而是注册表：

```ts
interface FieldTypePlugin<T = unknown> {
  type: string;
  Cell: React.ComponentType<CellProps<T>>;
  format(value: T): string;
  filterOperators: FilterOperator<T>[];
  validateFilter(value: unknown): value is T;
  compare?: (a: T, b: T) => number;
  searchableText?: (value: T) => string;
}
```

内置 `text / number / boolean / singleSelect / multiSelect / date / datetime / url / image / file / reference / computed`。业务可注册新类型，但页面没有“修改字段类型”的入口。

### 13.6 后端协议

推荐游标分页，不使用大 offset：

```http
GET /api/tables/:tableId/views
POST /api/tables/:tableId/views
PATCH /api/tables/:tableId/views/:viewId
GET /api/tables/:tableId/records?viewId=...&cursor=...&limit=200&query=...
POST /api/tables/:tableId/records
GET /api/tables/:tableId/records/:recordId
PATCH /api/tables/:tableId/records/:recordId
```

- `query` 是版本化 JSON 的 URL-safe 编码，包含 filters、sorts、search 和字段投影。
- 返回 `{ rows, nextCursor, total, revision }`。
- 视图 PATCH 携带 `If-Match: <revision>`，服务端冲突返回 409。
- 列顺序、宽度、显隐、筛选和排序一次性保存，避免多个请求产生中间状态。
- 搜索 200 ms 防抖；输入变化和切换视图立即 abort 旧请求。
- 默认每页 200 行，距离已加载底部约两个视口时预取下一页。

### 13.7 浮层与焦点

- 筛选、排序、视图配置使用 anchored Popover，位置、宽度和关闭规则逐项对照飞书。
- 新建视图使用轻量 Popover/Dropdown，不跳页。
- 全屏编辑使用 Dialog，并把焦点限制在编辑器中；关闭后焦点返回原行。
- 所有浮层通过 Portal 渲染，避免被虚拟表格的 `overflow` 裁切。
- Escape、点击外部、Tab 顺序和焦点恢复都写成 E2E 用例。

### 13.8 测试与质量工具

| 工具 | 覆盖范围 |
| --- | --- |
| Vitest | schema、query 编译、列重排、筛选运算符、reducer |
| React Testing Library + user-event | 工具栏、浮层、键盘、焦点和回调契约 |
| Playwright | 新建视图、保存、筛选、排序、搜索、拖拽、双击打开 |
| Storybook | 每个组件的默认、hover、active、loading、empty、error 状态 |
| Playwright screenshot | 与飞书参考截图进行像素/感知差异回归 |
| axe-core | ARIA grid、Dialog、Popover、键盘可达性检查 |

CI 顺序：`typecheck -> lint -> unit -> build -> e2e -> visual -> performance smoke`。

### 13.9 性能防线

- 开发演示内置 10 万行 × 100 列的确定性数据生成器。
- CI 记录滚动、视图切换、搜索输入和列拖拽的性能 trace。
- 滚动期间禁止网络请求和持久化；拖拽结束只提交一次 mutation。
- React Query 的 query key 由 `tableId + viewId + queryHash` 组成。
- 切换回已访问视图时先显示缓存，再按 `revision` 后台校验。
- 图片/附件单元格只加载视口附近资源，并使用固定尺寸占位，防止布局抖动。
- 公共包不打包 React；建立 gzip bundle budget，首版核心 JS 建议控制在 80 KB 以内（不含 peer dependencies）。

### 13.10 初始化命令建议

```bash
pnpm init
pnpm create vite apps/playground --template react-swc-ts
pnpm add -w -D typescript eslint prettier vitest @vitest/coverage-v8 playwright storybook msw
pnpm --filter @ntable/core add @tanstack/react-table @tanstack/react-virtual @dnd-kit/react @dnd-kit/helpers lucide-react
pnpm --filter @ntable/core add @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-dropdown-menu @radix-ui/react-checkbox @radix-ui/react-tooltip
pnpm --filter playground add @tanstack/react-query react-hook-form zod @hookform/resolvers
```

实际初始化时使用当前稳定版本并提交 `pnpm-lock.yaml`，不要在文档中硬编码所有 patch 版本。

### 13.11 迭代拆分

1. **Foundation**：workspace、tokens、primitives、schema、mock server、Storybook。
2. **Grid**：虚拟行列、固定表头/列、选择、列宽、双击回调。
3. **Views**：切换、新建、保存、字段显隐和当前视图持久化。
4. **Query**：筛选、排序、搜索、远程分页与缓存。
5. **DnD**：表头拖拽、插入线、浮层、边缘滚动、失败回滚。
6. **Parity QA**：与飞书逐状态截图对照、键盘与性能验收。
