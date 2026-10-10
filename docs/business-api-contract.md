# NTable 业务接口契约

本文面向业务前后端接入人员。当前源码契约以 [`types.ts`](../app/src/ntable/types.ts) 为准，筛选行为以 [`filtering.ts`](../app/src/ntable/filtering.ts) 为准。安装、组件组合及样式注意事项见 [组件接入文档](./component-integration.md)。

**当前组件不发送 HTTP 请求，组件包不提供后端服务。** 下文的数据结构和回调描述当前已实现能力；HTTP 路径和响应封装是可供业务系统采用的建议。当前 `rows` 必须是该业务范围内的完整数据，筛选、搜索、排序在浏览器执行。尚不支持服务端分页、远程查询、独立 `total` 或按需加载子记录。

## 1. 组件输入与接口适配

组件只要求 `fields`、`rows`、`views` 和 `activeView` 等 props，不要求业务提供统一 bootstrap 接口。字段、记录、视图可以来自多个接口、现有状态管理或其它数据源，由业务适配层组合。

以下 JSON 仅展示可采用的数据格式：字段名、标题、业务值和视图名称均可替换。`data` 封装和 `activeViewId` 是此示例的业务约定，不是组件协议。

```json
{
  "data": {
    "fields": [
      { "id": "code", "title": "编码", "type": "text", "width": 140 },
      { "id": "name", "title": "名称", "type": "text", "width": 220 },
      { "id": "quantity", "title": "数量", "type": "number", "width": 120 },
      {
        "id": "status", "title": "状态", "type": "singleSelect",
        "options": [
          { "value": "draft", "label": "草稿", "color": "#e8eaed" },
          { "value": "ready", "label": "已就绪", "color": "#d9f4e8" }
        ]
      },
      {
        "id": "tags", "title": "标签", "type": "multiSelect",
        "options": [{ "value": "web", "label": "网页" }]
      },
      { "id": "startDate", "title": "开始日期", "type": "date", "searchable": false }
    ],
    "rows": [
      {
        "id": "record-001", "code": "ITEM-001", "name": "记录名称",
        "quantity": 0, "status": "draft", "tags": ["web"],
        "startDate": "2026-10-01", "defaultExpanded": true,
        "children": [
          {
            "id": "record-001-01", "code": "01", "name": "子记录名称",
            "quantity": null, "status": "ready", "tags": [],
            "startDate": null
          }
        ]
      }
    ],
    "views": [
      {
        "id": "view-all", "name": "全部记录",
        "visibleFieldIds": ["code", "name", "quantity", "status", "tags", "startDate"],
        "columnOrder": ["code", "name", "quantity", "status", "tags", "startDate"],
        "columnWidths": { "name": 240 }, "frozenFieldCount": 2,
        "filterMode": "all", "filters": [], "sorts": []
      }
    ],
    "activeViewId": "view-all"
  }
}
```

`activeViewId` 是建议的业务响应字段，不是 NTable 的 prop。前端从 `views` 中找出对应对象后传入 `activeView`。`tableId` 也由业务层用于路由和鉴权，不是组件 prop。

## 2. 字段与记录格式

### 字段 Field

| 属性 | JSON 类型 | 必填 | 规范 |
| --- | --- | --- | --- |
| `id` | string | 是 | 稳定且唯一，与记录属性名及视图字段引用一致；不要使用 `id`、`children`、`defaultExpanded` |
| `title` | string | 是 | 显示名称；改名不改变 id |
| `type` | string | 是 | `text`、`number`、`singleSelect`、`multiSelect`、`date` |
| `width` | number | 否 | 默认列宽，单位 px；默认 140，业务输入建议限制在 88–1200 |
| `searchable` | boolean | 否 | 默认参与搜索；false 排除该字段 |
| `options` | array | 选择类型需要 | 每项为 `{ "value": string, "label": string, "color"?: string }`；value 唯一且稳定 |

选项颜色是显示元数据，当前单选使用其背景色，多选尚未使用每项颜色。字段 schema 由业务系统提供；组件不负责字段增删或类型编辑。

### 记录 TableRecord

每条记录为一个扁平对象，字段值直接以 `Field.id` 为 key；不要在交给组件的数据里额外套 `values` 或 `fields` 对象。接口采用其他结构时，由前端适配层转换。

| 字段类型 | 建议传值 | 示例 | 空值 |
| --- | --- | --- | --- |
| text | string | `"记录名称"` | null 或 `""` |
| number | 有限 number | `0`、`12.5`、`-3` | null；不要以 0 代表空 |
| singleSelect | option.value 字符串 | `"draft"` | null 或 `""` |
| multiSelect | option.value 字符串数组 | `["web"]` | `[]` 或 null |
| date | 日期字符串 | `"2026-10-01"` | null 或 `""` |

约束：

- `id` 是字符串，所有层级全局唯一，更新、排序及数据重新加载时保持稳定；不要使用数组下标作为 ID。
- `children` 是完整的递归记录数组，没有子记录可省略或传 `[]`。不允许循环引用或重复 ID。
- 子记录使用与父记录相同的字段 schema。业务若返回 `parentId` 扁平列表，需先组装成树；组件不会自动组树。
- `defaultExpanded` 是可选 boolean，Table 首次挂载时读取，不是受控展开状态。初次传入空 rows 后再异步加载，不会重新应用默认展开；可在数据就绪后挂载 Table。
- 不传 JSON 中无法表达的 undefined、NaN、Infinity 或函数。不要把对象当作普通单元格值。
- 单选值按 option.value 精确匹配；未匹配值显示 `—`。多选未匹配值会显示原始值。
- 日期当前直接显示字符串，不解析时区、不格式化。统一 `YYYY-MM-DD` 能减少字符串排序歧义。

## 3. 视图格式与持久化

| 属性 | 必填 | 规范 |
| --- | --- | --- |
| `id` / `name` | 是 | 稳定视图 ID / 显示名称 |
| `deletable` | 否 | 默认 `true`；`false` 隐藏此视图的删除菜单，业务端同步校验删除权限 |
| `visibleFieldIds` | 是 | 至少一个有效字段，不能重复 |
| `columnOrder` | 是 | 全部字段 ID 各一次；隐藏字段也要保留 |
| `columnWidths` | 否 | `{ "fieldId": width }`，优先于 Field.width |
| `frozenFieldCount` | 否 | 当前可见列从左起的期望冻结数量，不包含行号列；默认 0，最大为可见列数减 1。窄容器临时减少实际冻结列，宽度恢复后恢复；不会因布局适配提交或保存新值 |
| `filterMode` | 否 | `all` 或 `any`；默认 all |
| `filters` | 是 | 条件数组，没有条件传 `[]` |
| `sorts` | 是 | 优先级数组，没有规则传 `[]` |

`views` 至少保留一个视图，`activeView` 必须是其中有效的视图对象。字段 schema 变化后，业务层必须清理失效字段引用，并给新增字段补全顺序。

### 筛选条件

```json
{
  "filterMode": "all",
  "filters": [
    { "id": "filter-1", "fieldId": "quantity", "operator": "greaterThan", "value": "10" },
    { "id": "filter-2", "fieldId": "name", "operator": "isNotEmpty", "value": "" }
  ]
}
```

`value` **始终是字符串**，数字条件也传 `"10"`；数字记录仍传 number。`id` 在公共类型中可选，建议业务保存时保留稳定 ID，无 ID 条件也可以独立编辑和删除；保存稳定 ID 有助于跨请求追踪规则。

| operator | 文案 | 适用类型 | 行为 |
| --- | --- | --- | --- |
| contains | 包含 | 除 number 外 | 转字符串后忽略大小写包含 |
| notContains | 不包含 | 除 number 外 | 上述结果取反 |
| equals | 等于 | 全部 | number 按数值；其他类型字符串精确比较，区分大小写 |
| notEquals | 不等于 | 全部 | number 按数值；其他类型字符串不等比较 |
| greaterThan | 大于 | number | 数值比较 |
| lessThan | 小于 | number | 数值比较 |
| isEmpty | 为空 | 全部 | null、缺失值、空字符串、空数组为空；0 不为空 |
| isNotEmpty | 不为空 | 全部 | 上述结果取反 |

空值操作符隐藏输入框并清空原值，序列化使用 `value: ""`。切回需要输入的操作符，输入值仍为空。其他操作符的空字符串条件不生效；空白字符不会自动按空字符串处理，数字空白查询比较失败。

`all` 对有效条件做 AND，`any` 做 OR；没有有效条件时都返回全部记录。不要把未完成的条件作为 OR 中的恒真条件。数字比较拒绝空值和非有限数值，包括 `notEquals`。业务 API 应拒绝未知字段、未知 operator 和不适用的 operator/type 组合，当前组件没有完整输入校验器。

选择类型的筛选针对原始 option.value，而非 label。多选当前通过 `String(array)`（逗号连接）比较，尚无集合包含/交集语义；日期没有范围比较。这些限制在服务端复用查询逻辑时必须明确。

### 排序规则

```json
{
  "sorts": [
    { "id": "sort-1", "fieldId": "quantity", "direction": "desc" },
    { "id": "sort-2", "fieldId": "code", "direction": "asc" }
  ]
}
```

`asc` 对应“顺序”，`desc` 对应“倒序”。公共类型 `SortDirection` 已限定为这两个值，业务接口仍应校验输入。同一字段只配置一次。数组越靠前优先级越高，拖动后保存整个新数组。

number 字段按有限数值排序，支持负数、小数和零；空值、空白字符串及无法转换为有限数值的值，在顺序和倒序中都排在有效数值之后。其他字段将原始值转为字符串，使用中文自然顺序（numeric: true）比较；多选仍是逗号连接的字符串，日期仍按原字符串排序。同值保持原顺序，多规则按数组优先级比较。树形记录只在同级间排序，父子关系不变；这不代表宿主数据库排序自动具有相同语义。

筛选与搜索同时生效时两者为 AND。搜索忽略大小写，仅搜索当前可见且 searchable 不为 false 的字段，匹配原始值；单选和多选也匹配已配置选项的显示 label，忽略大小写。未匹配选项仍可按原始值搜索，隐藏或 searchable: false 的字段不参与任何搜索。该扩展不改变筛选/排序的原始值语义。子记录命中会保留祖先，父记录命中会保留整个子树。底部数量包含保留下来的所有层级记录，与折叠后的可见行数不同。

## 4. 组件回调与 HTTP 对接

| 回调 | 参数 | 业务责任 |
| --- | --- | --- |
| onActiveViewChange | `(viewId: string)` | 更新 activeView，按需保存用户偏好 |
| onUpdateView | `(viewId: string, patch: Partial<TableView>)` | 立即更新本地视图，再异步持久化 |
| onCreateView | `(name: string)` | 生成稳定 ID，完整初始化视图并保存，切换到新视图 |
| onDeleteView | `(viewId: string)` | 删除视图，拒绝删除 `deletable: false` 的视图，至少保留一个，并处理当前视图回退 |
| onAddRecord | `()` | 打开业务新增页面，保存成功后更新 rows |
| onOpenRecord | `(record: TableRecord)` | 双击打开业务详情页；使用 record.id 请求详情 |

以上回调返回类型为 void，组件不会等待 Promise，也不会自行恢复请求失败。宿主可向 NTable/Table 传 `loading?: boolean`、`error?: string | null`、`onRetry?: () => void` 展示请求状态并接收重试意图；宿主负责立即进入 loading、完成后更新 rows/error，刷新期间保留旧 rows。loading 优先于旧 error；没有 onRetry 时只展示错误。子元素在业务详情页新增，不提供行内新增子元素动作。

NTable/TableToolbar 的 `searchDebounceMs` 默认为 300。输入框 onChange 同步回显，中文组词结束后才防抖提交查询；清空立即生效。独立 TableToolbar 接收 `searchResetKey`，外部清空时递增可取消未提交草稿。直接向 Table 传 search 不经过输入防抖。详细空态、键盘及组合回调见 [组件接入文档](./component-integration.md)。

### 建议 HTTP 接口

以下为可选的业务侧参考设计，路径、方法、响应封装均可按现有系统调整，组件不会自动调用。bootstrap、详情或写入接口也不要求全部实现：它们取决于业务实际开放的功能。

| 方法与路径 | 请求 | 成功响应建议 |
| --- | --- | --- |
| GET `/api/tables/:tableId/bootstrap` | 无 body | 第 1 节示例的组合数据（可拆成多个接口） |
| PATCH `/api/tables/:tableId/views/:viewId` | 视图 patch | `{ "data": TableView }`，返回合并后的完整视图 |
| POST `/api/tables/:tableId/views` | 完整新视图 | `{ "data": TableView }`；建议客户端生成稳定 ID |
| DELETE `/api/tables/:tableId/views/:viewId` | 无 body | 204，无 body |
| GET `/api/tables/:tableId/records/:recordId` | 无 body | `{ "data": TableRecord }` 或业务详情 DTO |
| POST `/api/tables/:tableId/records` | 业务定义的新增 DTO | `{ "data": TableRecord }` 或业务定义的保存结果 |
| PATCH `/api/tables/:tableId/records/:recordId` | 业务定义的编辑 DTO | 同上 |

新增/编辑 DTO 的必填项、业务校验和父记录关联由业务系统定义，不要直接把展示用 TableRecord 当作允许写入的字段白名单。所有接口由服务端校验身份、数据权限和字段权限。

视图 PATCH 示例：

```http
PATCH /api/tables/example-table/views/view-all
Content-Type: application/json

{
  "filterMode": "any",
  "filters": [
    { "id": "filter-1", "fieldId": "quantity", "operator": "greaterThan", "value": "10" },
    { "id": "filter-2", "fieldId": "status", "operator": "equals", "value": "ready" }
  ]
}
```

合并语义是 **仅在视图顶层浅合并**：body 未出现的属性保留；出现的数组和 `columnWidths` 整体替换。例如 `filters: []` 清空筛选，`columnWidths: { "name": 240 }` 替换宽度映射，不自动保留其他 key。不要递归合并数组或按索引合并规则。

前端收到 onUpdateView 后，先以 `{ ...view, ...patch }` 更新 state，随后请求保存。列宽、拖列和筛选均可能连续触发保存，建议按视图串行保存或合并待发送 patch，避免旧响应覆盖新状态。若采用版本号/ETag，需由业务接口和适配层一同实现；组件不内置版本字段。失败回滚要确认期间没有更新的本地操作，否则应提示重试或重新加载。

建议错误响应统一为：

```json
{ "error": { "code": "INVALID_VIEW", "message": "筛选字段不存在", "requestId": "req-123" } }
```

建议使用 400/422 表示数据校验失败，401/403 表示身份/权限失败，404 表示资源不存在，409 表示并发冲突（若实现版本控制）。组件不读取这个结构，业务层负责展示和恢复。

### 用户级筛选与配置归属

界面提示“此次筛选仅对自己生效”。业务接入时必须落实该语义：filters/filterMode 保存到当前用户的视图覆盖配置，或保持会话内状态；不要直接覆写其他用户共用的筛选设置。共享视图基础配置与个人覆盖配置可在服务端合并成一个 TableView 返回。其余布局/排序是否共享，需要业务明确归属和权限。

## 5. 服务端分页的边界

当前不要只把第一页 records 填入 rows 并把服务端 total 当作表格总量：组件无法消费 total，滚动高度只来自已传入的记录，本地筛选和排序也只覆盖这些记录。虚拟滚动只减少 DOM 渲染数量，不等于远程分页。行和列都按视口挂载，冻结列和活动单元格保留；`getCellProps` 只为当前挂载的单元格调用，滚动或状态更新可能重复调用，应保持纯函数，不用它统计记录或触发业务请求。

如业务数据量必须采用服务端查询，需要先扩展组件契约（例如 remote query、total、分页占位、加载窗口和树节点按需加载），并关闭相应本地计算。接口可采用 `{ filters, filterMode, sorts, search, offset, limit }` 请求与 `{ rows, total }` 响应，但这些远程查询字段**目前没有接入能力**。loading/error/onRetry 仅展示外部请求状态，不代表远程查询模式。

## 6. 接入检查清单

1. 真实数据源能适配为 fields / rows / views，业务选择的 activeView 是 views 中的有效对象。
2. 字段、选项、记录、视图与规则 ID 稳定，字段引用有效，树无重复 ID。
3. 数字 0 与 null、多选空数组、单选原始值、日期字符串验证正确。
4. filters.value 是字符串，空值条件使用空字符串，all/any 和多条排序优先级正确。
5. 视图 patch 使用顶层浅合并；连续保存、失败和权限分支经过验证。
6. 新增/详情由业务实现，保存后用新对象和新数组更新 rows；避免原地修改影响 memo/cache。
7. 确认个人筛选隔离、完整数据范围及真实数据量；仅通过构建不代表接口业务验收通过。

视图可返回可选布尔字段 `deletable`（默认 `true`）。设为 `false` 时组件隐藏删除菜单；该值应由业务权限或系统视图规则计算，服务端删除接口仍需独立校验，不能信任客户端提交的权限字段。
