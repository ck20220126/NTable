# 当前工作区双轴审查（2026-10-08，第五十一轮）

基点为 HEAD 891511496a4d896e3565e04a118d12e2818f504b，无基点后提交；范围为全部未提交修改以及新增源码/构建/测试。使用 code-review 技能，Standards 与 Spec 两个只读代理分开审查。规范以根和 app/AGENTS.md、公共 types.ts 和接入契约为准；旧远程分页草案不作为本次Spec。Safari极致帧率不作为阻断。

## Standards

初轮2项：P2契约硬规则——business-api-contract.md排序描述仍是全字符串，与源码有限数值排序矛盾；P2状态一致性判断——列菜单保存旧index，同视图外部列序/可见字段/schema更新后可能修改另一列。除此以外未发现实质打包、资源清理和边界违背，不建议仅凭气味拆分Table。

两项已整改，定向复核未发现新风险。前者同步真实number、无效值及其他类型字符串语义；后者在field/index不再对应当前列对象时layout阶段关闭，仅菜单持有焦点时恢复grid，preventScroll。

## Spec

初轮未确认新的明确运行时Spec缺口，1项契约文档冲突与上述排序描述同源。只读观察到横向滚动后冻结列拖拽坐标可能有风险，但算法基点已存在且未实测，未计为新增finding。此疑点需要后续验证，不把未复现猜测当缺陷。

整改定向复核无新阻断。菜单关闭覆盖schema替换、移除、隐藏和重排；保守行为是宿主重建语义相同Field对象也会关闭菜单，数据正确性不受影响。

## 运行时与工程验证

旧构建实测：延迟移除amount字段并清理view引用，原“数值”菜单仍开，“增大列宽”错误提交status176。修复后同路径菜单关闭、宽度未提交、菜单聚焦时返回grid；同视图外部旋转列序也关闭旧菜单，重开后加宽只提交amount126。外部宿主按钮聚焦且旧菜单尚在时，列序更新关闭菜单但保持“恢复数据”按钮焦点。

最终库源码verify46/46、消费者后续fixture严格类型/生产构建、git diff --check通过。实际tarball kun-ntable-0.1.0-menu-invalidation-20261008.tgz解包严格Bundler/NodeNext与4导出通过；本地依赖树，不是干净网络安装。证据column-menu-invalidation-20261008.json、menu-invalidation-package-20261008.json。截图quality-column-menu-current.png已检查，显示最后列序和amount126提交结果。

Standards初轮2项均已整改；Spec初轮1项文档冲突已整改。完整产品交付仍未证明完成，IME/读屏/触屏及其他已登记覆盖项继续开放，目标active。
