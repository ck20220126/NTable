# NTable

独立 React 组件库，提供受控视图、字段显隐、筛选、排序、搜索、列宽与顺序、冻结列、虚拟滚动和层级记录。业务系统负责数据加载、持久化、权限与记录编辑。

本地 release 版本为 `0.1.0`，包名为 `@kun/ntable`。当前包保持 `private: true`，尚未公开发布。

```sh
cd app
npm run verify
npm pack --dry-run
```

库构建独立运行 `npm run build:lib`，输出 ESM、公共类型声明与 CSS 到 `app/dist/lib/`。React / React DOM 19.2 由宿主提供。演示和 Sites 构建仍使用 `npm run build`。

```tsx
import { NTable, type Field, type TableRecord, type TableView } from '@kun/ntable';
import '@kun/ntable/style.css';
```

宿主需提供明确高度的容器。CSS 只影响组件根、独立组合根与组件浮层，不修改宿主页面全局样式。多个实例各自持有受控视图和记录状态。

完整接入说明见 [业务接入文档](docs/component-integration.md)，数据格式见 [业务接口契约](docs/business-api-contract.md)。公共类型以 `app/src/ntable/types.ts` 为准。`app/src/App.tsx` 为演示业务，未包含在库包内。

当前产物和交付验收状态见 [交付验收矩阵](docs/delivery-readiness-2026-10-08.md)，详细整改证据见 [产品质量记录](docs/product-quality-2026-10-08.md)。[2026-10-03 release 审查报告](docs/release-review.md) 保留其历史版本结果，不代表后续所有改动已验收。
