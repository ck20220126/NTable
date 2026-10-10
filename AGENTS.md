# NTable 工程约定

NTable 是独立 React 组件库。`app/src/ntable` 是表格实现，`app/src/components` 是内部共享控件；`app/src/App.tsx` 是业务接入演示，不进入库产物。

- 公共契约以 `app/src/ntable/types.ts` 为准，接入文档位于 `docs/`。
- `app/` 保留演示和 Sites 构建链；库构建另用 `build:lib`，产物放 `app/dist/lib`，不得混入演示页面或 worker。
- 库样式只影响 `.ntable`、独立组合的 `.ntable-scope` 和组件 portal 的 `.ntable-portal`，不得修改宿主 body、root 或原生控件全局样式。
- React / React DOM 由宿主提供。产物必须包含 ESM、公共类型声明和独立 CSS。
- 测试放 `app/tests/`，验证构建、数据处理、交互边界及打包契约；审查与验收证据放 `docs/`。截图放 `app/qa/`。
- 发布检查运行 `npm run verify`，并检查 `npm pack --dry-run`。本地 release 准备不包含 push、公开 publish、部署或改 CI 配置。
- 当前目录已有的未提交修改是工作成果，整改不得回退。遵循 `app/AGENTS.md` 中的产品规则。
