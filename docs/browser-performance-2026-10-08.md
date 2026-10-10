# 浏览器运行性能测量

本轮测量的是生产消费端页面，未修改库实现或公开 API。页面可见、25,000 条扁平记录、2 字段、240px 网格视口；数据生成在测量起点之前。每个阶段从宿主状态更新开始，等待实际 DOM 的记录数/排序结果与 aria-busy 稳定，再等待两次 animation frame。超时或页面转入后台会报失败，不计通过。

因此 `updateToTwoFramesMs` 包含浏览器调度和帧等待，**不是纯 CPU 耗时、FPS、真实指针响应延迟或网络耗时**。每轮结束恢复小数据和原视图。对该配置没有观察到需要立刻改实现的性能瓶颈；不外推为任意规模或设备均流畅。

| 引擎/阶段 | 第一次 ms | 第二次 ms | 第三次 ms | 挂载记录行 |
| --- | ---: | ---: | ---: | ---: |
| Chromium 装载 25,000 行 | 55.5 | 44.7 | 45.8 | 20 |
| Chromium 数量倒序 | 50.9 | 50.2 | 50.0 | 21 |
| Chromium 数量等于 24999 | 50.0 | 50.2 | 50.1 | 1 |
| Chromium 清空筛选/排序 | 50.0 | 50.0 | 50.0 | 21 |
| Safari 装载 25,000 行 | 77 | 51 | 54 | 20 |
| Safari 数量倒序 | 67 | 66 | 49 | 21 |
| Safari 数量等于 24999 | 67 | 67 | 60 | 1 |
| Safari 清空筛选/排序 | 50 | 50 | 51 | 21 |

Chromium 每阶段结束时活动后代均存在，25,000 条记录只挂载 20–21 行；每段 PerformanceObserver 观察到的 >50ms longtask 为空。Safari 的该接口不支持，明确输出 unsupported，不能写成零长任务。Safari 在补充紧凑摘要之前的首次运行还观察到装载 129ms、排序 83ms，保留这项冷启动差异，不用后三次覆盖它。

原始记录：[Chromium JSON](../app/qa/browser-performance-20261008.json)、[Safari 摘要](../app/qa/safari-performance-20261008.txt)。内置浏览器未支持 raw CDP Browser.getVersion，记录引擎而不猜具体版本。重复测量只能说明本机当前配置的稳定性；列数、深树、复杂单元格、缓存切换和连续滚动的帧表现仍待补齐。

测量入口为 tests/consumer 的“运行浏览器性能测量”，逻辑位于 performance-checks.ts。它只用于验收，不进入库 tarball。运行前请恢复正常数据/视图并保持页面可见；不要在测量期间更改宿主状态。类型检查和生产消费构建通过，库仍是上一轮 view-focus 安装包。


## 第三十三轮：浏览器滚轮输入观测（未作为性能通过）

消费端新增 observeWheelPerformance，只观察 wheel/scroll 与 requestAnimationFrame，不修改滚动位置、不 preventDefault。记录可信 wheel 数、滚动数、最后输入后 120ms 内的活动帧间隔；总 duration 含等待输入/工具调用间隔，不作为纯滚动耗时。帧样本最多 2000、慢帧位置最多 10、longtask 最多 32；结束、重复开始、表格卸载和 fixture 卸载清理监听/rAF/PerformanceObserver。支持带 DOM 覆盖采样和不采样 DOM 两种模式。coverage 在实际位置改变的 rAF 读取几何，建立 DOM 可见区域覆盖证据，不保证每个已呈现像素帧或输入到屏幕延迟。

Chromium 最新 2000 行×42 列消费端，CDP Input.dispatchMouseEvent mouseWheel 纵横各 12 次，每次 160px。首个带覆盖样本：24 wheel/24 trusted/24 scroll，49 活动帧，P95 17.6ms、max 33.8ms、>50ms 为 0，横纵 coverageMisses 均 0、最多 330 单元格、longtask 空；scrollTop/Left 均最终 1920，browser-wheel-coverage-20261008.json。来源是浏览器协议滚轮输入，区别于直接设置 scrollTop，也不能称为物理触控或人体操作时延。

首个不采样 DOM 反向样本：24 trusted/scroll、49 活动帧、P95 17.5ms、max 116.7ms、>50ms 1、longtask 空，回到 0/0（browser-wheel-frames-20261008.json）。保留异常，不用 P95 掩盖最大帧间隔。补慢帧定位后再重复三波正/反/正：P95 17.6/17.6/17.5ms；首波 max 82.4ms、一次 >50ms（offset 391ms，wheel/scroll 各 2），后两波 max 17.6ms、无 >50ms。原始 browser-wheel-frames-repeats-20261008.json。存在首波异常倾向，但还不能归因为冷启动、调度、工具开销或组件渲染，也不能凭后两次暖态通过就说已解决。

Safari 原生 scroll 操作探针首波只捕获 3 个 trusted wheel/scroll、17 帧，P95 55ms、max 69ms、慢帧 3；尝试横向未增加可信 wheel 计数，因此只证明已捕获的纵向输入。AX 长 JSON 超过约 512 字被截断，见 browser-wheel-native-safari-20261008.txt，不能据它恢复未返回部分。新增简短结果摘要后重测 3 次原生向下滚动：valid true、3 trusted、18 活动帧、P95 54ms、max 74ms、慢帧 2，scrollTop 723/Left 0，longtask unsupported。证据 browser-wheel-native-safari-repeat-20261008.txt 与 quality-wheel-safari-sample.png（已检查，完整屏幕报告可见）。样本少且每次输入间有原生 AX 观察，不是无间断手势；Safari longtask 不支持不能解释为空任务。

消费端 typecheck:consumer/build:consumer 最终退出码 0，包含严格 Bundler/NodeNext；库源码和第三十二轮实际包未变，不声称本轮重做全量 verify/打包。console error 0、git diff --check 通过。当前实际滚轮性能存在未解释慢帧，交付性能门禁保持未完成；下一轮需对首波和 Safari 原生输入采集更强归因证据。


## 第三十四轮：主线程计数与原生容器对照

本轮只修改消费 fixture：滚轮观测新增最多 8 项 long-animation-frame entry JSON（支持时），结束/卸载清理 observer；添加独立纯原生滚动容器，64000×8000 内容，无表格虚拟化或 React 滚动更新。同一被动探针、同一 Chromium 24 trusted wheel 正纵横输入，保持诊断模式一致。临时启用 CDP Performance 计数并在轮末 disable，不留浏览器调试配置。

2000×42 表格实际输入 24 次：49 活动帧，P95 17.7ms/max 33.5ms，无 >50ms、longtask 和 long-animation-frame 均空；累计 TaskDuration 312.72ms、ScriptDuration 99.34ms、LayoutDuration 13.48ms、RecalcStyleDuration 26.27ms。CPU 计数覆盖输入循环整个时段，不是单帧或纯 React 时间，各分项不应相加为互斥总量，不能用它归因上一轮某个异常帧。记录 wheel-table-cpu-20261008.json。

纯原生容器实际相同 24 次协议输入：26 活动帧，P95 17.1ms/max 17.6ms，无 >50ms/longtask/long-animation-frame；TaskDuration 19.98ms、ScriptDuration 1.82ms、Layout/RecalcStyleDuration 均 0、DevToolsCommandDuration 0.59ms。最终两轴均 1920，wheel-baseline-cpu-20261008.json。原生容器有不同 DOM/绘制内容，且测量时表格仍在页面其他位置；这是定性/总成本对照，不是完整因果隔离实验。两组 duration 1112/716ms 和活动帧数不同，不能用 312/20 的比值直接声称实际用户 FPS 或时延倍率。

Safari 同一最新构建，原生容器三个向下操作：3 trusted、24 活动帧，P95/max 17ms、慢帧 0，scrollTop 909，wheel-baseline-native-safari-20261008.txt。再切 2000×42 表格三个向下操作：3 trusted、23 帧，P95 50ms/max 54ms、慢帧 2（首、次事件邻近），scrollTop 723，wheel-table-native-safari-compare-20261008.txt。原生操作按容器高度滚动，两组距离/视口高度不同，不能称为所有变量一致的 A/B。该对照支持优先继续调查表格滚动更新路径，不足以证明具体函数或否定浏览器/工具调度贡献。Safari longtask/long-animation-frame 均 unsupported，不当作空样本。

最新消费端 typecheck:consumer/build:consumer 退出码 0，严格 Bundler/NodeNext 通过；库代码/实际包未改变，仍对应第三十二轮。console error 0、git diff --check 通过，截图 quality-wheel-safari-comparison.png 已检查。当前异常未归因完成，性能门禁继续未通过；下一步需要在表格滚动时定位 React 挂载/更新、布局与样式热点，并用相同事件和覆盖检查验证任何优化。


## 第三十五轮：滚动 CPU 采样与挂载热点

本轮不修改生产库或 fixture 行为。临时以 build:consumer -- --sourcemap 构建诊断消费端，CDP Profiler 以 1000µs sampling interval 采集同样 24 个可信协议滚轮输入；轮末 stop/disable，恢复不带 sourcemap 引用的正常 build:consumer。源码映射使用本地已有 trace-mapping，不安装依赖、不修改构建配置。诊断 map 和 profile 只用于当前构建归因，不进入库 tarball。

对应被动探针记录 24 trusted/scroll、54 活动帧，P95 17.6ms、max 50.3ms、一次 >50ms（offset 230ms，wheel/scroll 各 2），最终两轴 1920。longtask 空，但 long-animation-frame 有一条 108.2ms，scripts 空、blockingDuration 0、firstUIEventTimestamp 0。两种观测不等价；不能把 longtask 空写成没有长动画帧，也不能把该条空 scripts 记录归因为某个函数。采样器本身增加开销，本次不是无采样性能复验。原始 wheel-scroll-profile-sample-20261008.json。

CPU profile 覆盖约 915.21ms、675 样本。按 timeDeltas 加权的 self samples：idle 500.99ms、program 263.73ms、Radix use-size 的 layout effect 22.47ms、TanStack observeElementOffset 17.59ms、GC 7.92ms。它们是统计采样归属，不是精确函数耗时；program/native 未细分，不能算作 React 时间，profile 与 rAF 探针的采集起止也不同。原始 wheel-scroll-cpu-profile-20261008.json，映射结果 wheel-scroll-cpu-mapped-20261008.json。

热点调用链从 TanStack observeElementOffset → notify/onChange → flushSync → React commitLayoutEffectOnFiber → Radix useSize layout effect，见 wheel-scroll-size-callchain-20261008.json。核对当前安装源码：CheckboxBubbleInput 调用 useSize(control)，读取 offsetWidth/offsetHeight 并建立 ResizeObserver；当前消费 fixture 包在宿主 form 内，虚拟行使用 Radix Checkbox，因此行换入会执行表单桥接尺寸测量。此证据支持优先对照行复选框挂载成本，但没有证明它独自造成前轮 Safari 慢帧，也没有将浏览器未分类时间归给它。保留同步滚动提交规则和现有复选框语义，下一步先做隔离对照再评估替换或减少挂载成本。

最终 typecheck:consumer（含 Bundler/NodeNext）与正常 build:consumer 均退出码 0，未修改生产源码，实际库包仍对应第三十二轮。console error 0、git diff --check 通过；quality-wheel-cpu-profile.png 已检查，报告保留慢帧和长动画帧。性能门禁仍未完成。

第三十六轮对照约定：只在消费 fixture 中切换宿主 form/div，默认保留 form；切换允许重新挂载表格，受控记录/视图不改变。每组重新加载同样 2000×42 数据，从两轴 0 开始，用相同 24 个协议滚轮事件。以当前 DOM 中桥接 input 数确认差异，比较 CPU 计数和帧间隔；避免把 form/div 宿主场景差异直接解释为复选框单一因果或产品修复。


## 第三十六轮：原生行复选框与成本对照

消费端默认仍在 form 内，新增 form/div 切换入口；切换会重挂载组件，受控记录/视图保留。每组重建 2000×42 数据、两轴 0 开始，执行纵横各 12 次 160px 协议输入。浏览器实际捕获有 23 或 24 trusted wheel（scroll 均 24，最终 1920/1920），因此只称为相同 24 次协议调用，不称为每组 24 个已观测事件。

原实现 form/div 交替两轮：隐藏桥接 input 21/0；累计 ScriptDuration 为 113.90/93.28ms、201.11/99.37ms，TaskDuration 367.50/328.52ms、712.30/380.33ms。原始 wheel-form-host-comparison-20261008.json。总成本波动较大，场景差异不只一个函数，不能证明该桥接是全部慢帧根因。

先更新产品规则，再把行选择改成受控原生 input checkbox；保持布尔 checked、15px 控件、12px 白色勾选图标、负 tabIndex、label、双击停止传播、Enter 阻止表单默认动作。表头三态仍使用 Radix。行 input 无 name，不增加宿主业务 FormData 字段；forced-colors 设置 appearance auto，但本轮没有实际系统高对比主题验收。核对 Context7 官方 React input 契约，用 event.currentTarget.checked 同步更新选择，不读 value，不切换受控模式。

指针实测首次候选未选中，进一步核对：网格 click capture 中的活动状态/焦点更新会让同步提交在 onChange 前重置原生 checked。最终让原生行 input 不经过网格 click capture，在 onChange 先读 checked，再更新活动行、清空范围锚点、提交选择并恢复网格焦点。实际 Chromium 协议指针选中后 checked true、aria-selected true、焦点 grid；初次仅移动 focus 的修正不充分，未作为最终成果。视觉检查另发现基础 checked background shorthand 重置了 background-size/position，最终 checked 规则显式恢复 12px/center，截图已复验。

候选实现初始四组 form/div 的 ScriptDuration 89.79/82.07ms、76.89/86.03ms，form 桥接仅剩表头 1 个；但 div 第二波 max 82.3ms。wheel-native-checkbox-comparison-20261008.json 属于选择时序修复前的滚动诊断，不作为最终交互验收。最终时序修复后两轮 form ScriptDuration 113.52/103.34ms、TaskDuration 444.37/430.91ms；P95 均 66.7ms、max 150/83.6ms（wheel-native-checkbox-final-20261008.json）。不能据初始四组宣布最终性能已稳定提升。保留本项是减少每个虚拟行的表单代理与尺寸监听，并保留已经验证的原生行为；持续滚动门禁仍未通过。

最终 Chromium 带几何覆盖输入：23 trusted/24 scroll、50 帧、P95 116.7ms/max 200.1ms、9 次 >50ms、longtask 91ms，long-animation-frame 记录最多 8 条；其中有 DIV.onscroll 脚本约 10.8ms、forcedStyleAndLayoutDuration 0，其余多条 scripts 空，不能把整条帧时长归给该脚本。横纵 DOM coverageMisses 均 0、最大挂载 363 cells，最终 1920/1920。wheel-native-checkbox-coverage-20261008.json。采样包含 DOM 读取，覆盖通过不等于帧性能通过。

Chromium 单击选择、表头 mixed、双击不打开记录/不提交表单、直接 input Enter 不提交/不打开、直接 input Space 取消选择、表头全选 4 条/checked true 通过，见 native-checkbox-chromium-selection-20261008.json。两引擎 9 项键盘事件回归均通过（合成键盘事件，不替代真实辅助技术）；Safari 原生单击选择 Value 1、双击仍为 1、打开记录无/表单提交 0，native-checkbox-safari-selection-20261008.txt。Safari 最终滚轮小样本 3 trusted、17 帧、P95 68ms/max 94ms、慢帧 2、top 723，longtask unsupported（wheel-native-checkbox-safari-20261008.txt）。Safari 仍有慢帧，未声明这项消除性能问题。

最终全量 verify 45/45，严格库/消费类型、演示/Sites/lib/消费构建、pack dry-run 门禁通过，大 chunk 警告保留。新实际包验证见 native-row-package-20261008.json（本地依赖树复用，非全新网络安装）。console error 0；quality-native-row-checkbox.png 已检查。Profiler/Performance 临时状态均关闭，默认 form 已恢复，整体目标 active。


第三十七轮候选验收约定：固定 32px 行的 overscan 从每侧 12 行试验为 4 行，不改完整数据投影、活动行保留、列窗口和同步提交。候选必须覆盖当前两轴输入、末行/末列键盘跳转及两引擎键盘回归；若 DOM 可见区域缺行/列、焦点身份失效或交互回归，修复或拒绝候选。单次暖态改善不作为持续性能完成。


## 第三十七轮：收紧固定行缓冲并保留覆盖证据

当前第三十六轮最终构建交替原生基线/2000×42 表格各两组：基线累计任务 23.49/29.07ms、脚本 2.62/2.02ms、max 33.8/17.7ms；表格任务 344.19/304.70ms、脚本 95.59/77.66ms、max 33.3/17.6ms。上轮 150/200ms 异常本轮没有复现，不用这组正常结果覆盖此前异常。计数是完整协议循环累计，非互斥分项/单帧/输入延迟，wheel-alternating-baseline-20261008.json。

Context7 核对 TanStack Virtual 官方 overscan 契约：表示可见区上下额外挂载项数，增加会提高渲染成本、减少滚动空白风险。候选把固定 32px 行的 overscan 从每侧 12 改为 4，保留范围提取中的活动行、同步滚动提交、完整数据投影和列窗口。首屏挂载行 20 降至 12；相同两组协议调用累计任务 259.57/249.77ms、脚本 81.40/72.14ms、max 17.7/17.5ms，wheel-overscan-four-20261008.json。当前捕获 23 trusted/24 scroll，协议调用数仍为 24；不能把少一条观测事件隐去，也不能将本机短样本差异外推为设备普遍性能百分比。

Chromium 程序滚动 262 次（纵向 240/横向 22）：横纵覆盖缺口 0、最多 18 行/144 cells、P95 17.6ms/max 65.7ms、一次 >50ms、longtask 空，overscan-four-coverage-chromium-20261008.json。Safari 初次 AX 局部 JSON 读到 P95 65ms/max 569ms、37 次 >50ms、纵向缺口 0；文本尾部截断，未将它作为完整横向结果。为实际得到完整证据，fixture 新增程序滚动紧凑摘要；最新构建重跑同样 262 次，横纵缺口均 0、最多 18 行/144 cells、P95 67ms/max 354ms、37 次 >50ms，最终 0/0，overscan-four-coverage-safari-20261008.txt。保留两个异常样本，程序回放不是物理滚动时延，也不证明当前 Safari 流畅度。

额外 Chromium 大幅协议滚轮 6 次调用（20000px 纵向三次、反向 40000px，横向 ±4000px）：捕获 5 trusted/6 scroll、横纵覆盖缺口 0、最终 top 20000/left 0、max 132.4ms，overscan-four-large-input-20261008.json。Control+End 再 End 实际浏览器键盘操作到第 1999 行、第 42 列，活动文本业务字段40/记录1999、焦点 grid，末行 bottom 与 viewport bottom 一致、末列 right 一致，overscan-four-last-cell-20261008.json。两引擎恢复小数据/视图后 9 项键盘事件回归通过，Safari 保存 overscan-four-keyboard-safari-20261008.txt；这些是合成键盘回归，不代替真实系统 Tab 或辅助技术。

据已验证的覆盖和范围行为保留 4 行缓冲并更新产品规则；只声明降低预渲染规模及本机这两轮累计成本，不声明持续性能完成。最终全量 verify 45/45、严格库/消费类型、构建与 pack dry-run 通过。新实际 tarball 严格 Bundler/NodeNext 解析和四个 ESM 导出通过，见 overscan-four-package-20261008.json；依赖复用本地树。console error 0、git diff --check 通过，quality-overscan-four-last-cell.png 已检查。Profiler/Performance 无残留开启，表单默认状态保留，性能门禁和整体目标仍未完成。


## 第三十八轮：拒绝共享 Tooltip Provider 候选

当前每个单元格独立 Provider。Context7 读取 Radix Tooltip 官方契约，Provider 可以共享 delayDuration/skipDelayDuration；核对当前安装实现，Provider 还共享 isPointerInTransitRef。试验将一个 Table 的单元格置于共同 Provider，初始延迟 400ms、默认 skipDelay 300ms，完整 Root/Portal、悬停内容和滚动/Escape 仍由 Radix 管理，不手写提示坐标或计时。

相同 2000×42、每组 24 次协议调用（捕获 23 trusted/24 scroll）的两轮：原实现累计任务 256.32/239.38ms、脚本 75.44/68.43ms；共享候选任务 239.85/238.09ms、脚本 74.94/67.71ms，max 均约 17ms。差异小、缺少交错反复对照，不宣称稳定收益。原始 tooltip-provider-before-20261008.json、tooltip-provider-after-20261008.json。

候选实际 Chromium 先悬停完整长文本，再移动到同一行数值 12.5；命中 SPAN 文本 12.5，trigger data-state closed，旧长文本 tooltip 仍保持。多次后续 pointer move 仍未接替，tooltip-shared-handoff-rejected-20261008.json。核对 Provider 的过渡区状态与 Trigger 的进入保护，支持共享 hover corridor 拦住新触发器这一解释；未测量私有状态，不把它写成全部场景的唯一因果结论。

撤回共享 Context/Provider/表格 wrapper，只保留拒绝记录和产品规则。恢复独立 Provider 后相同路径：数值 trigger delayed-open、唯一内容 12.5，getByRole tooltip 12.5 最终可见；Escape 后提示最终不存在，tooltip-independent-handoff-20261008.json 和已检查 quality-tooltip-handoff-restored.png。最初滚动后立即读取仍有旧节点，后续等待提交确认已关闭；不要用事件后瞬时节点数量判断 dismissal 失败。测试期间一次使用滚动前坐标导致第二次悬停未命中，已重新读取几何再测，不把该 timeout 归为产品缺陷。

此候选拒绝原因是收益不明确且影响完整值提示接替。最终 index.js/ntable.css 与第三十七轮已验实际包逐字节相同；全量 verify 45/45、strict 类型、全部构建及 pack dry-run 通过，console error 0、git diff --check 通过。没有发布新包或将候选算作性能修复；库实际包继续对应 overscan-four，性能与整体目标仍未完成。


## 第四十二轮：缓存线性列几何，移除平方级前缀计算

当前 Table 每次渲染按每个 index slice/reduce 重算起点，并重复构建宽度数组、grid template、总宽和拖拽起点。先补工程规则，再增加 columnGeometry 单遍历产生全部起点/末尾插入边界、总宽和模板；Table 将 fieldWidths 和 geometry 依 orderedFields/liveWidths 缓存，冻结样式、列窗口、拖拽起点和插入位置复用。没有改变滚动同步提交、列窗口覆盖或 Tooltip Provider。

新增不等宽/空字段/末尾边界测试；10,000 列代理计数证实每个宽度只读取一次。独立 Node 几何小样本：42 列 10,000 次旧 12.23ms、新 8.61ms；1000 列 500 次旧 124.57ms、新 8.73ms，结果逐项相同。该对照是孤立计算，不代表浏览器滚动性能或全部产品收益。

最终构建两引擎各 262 次程序回放（240 纵/22 横）均无 DOM 覆盖缺口，最多18行/144 cells。Chromium max17.7ms/P95 16.9ms；Safari max92ms/P95 61ms、29次超过50ms，仍不满足性能交付。不能用较早354ms和本次92ms的不同样本宣布 Safari 修复。Chromium 末列 700/600/900px 容器宽度回归保持活动身份、焦点和无遮挡；实际网格 Shift+Right 将名称宽从250增加到266，相邻起点同步+16；Alt+Right 重排为数量/名称且保持宽度。

宽表数据不符合现有键盘 fixture 的树行前提，首次运行返回 null focus；恢复四条树记录后9项事件通过，未隐去该前提失败，也未把它当作生产键盘错误。当前消费控制台 error 空。

全量 verify 46/46（含新增几何测试）、严格消费两种解析模式及所有构建通过；新实际包 kun-ntable-0.1.0-column-geometry-20261008.tgz 解包后严格 Bundler/NodeNext 和四个导出通过，复用现有依赖树；git diff --check 通过。证据 column-geometry-cost/chromium/safari/keyboard/package-20261008 和已检查截图。保留 Safari 慢帧、真实设备输入和全部尚缺验收项，目标 active。

![实际列宽调整后重排，活动列保持可见](../app/qa/quality-column-geometry.png)


## 第四十三轮：稳定滚动容器监听器生命周期

源审查确认 AutoHideScrollArea 的 hovered 依赖会在每次进入/离开时重建 scroll 监听器和 ResizeObserver、读取尺寸并重新初始化边缘锚定。先补产品规则，再让观察只持续一个挂载生命周期，回调通过 hoveredRef 读取即时状态。进入时取消遗留隐藏计时，拖拽结束回调也读当前悬停而非开始拖动时的闭包值；卸载继续清理计时、监听器及观察。保留原显隐样式、900ms 时长和所有手势取消路径。

工程结构确定减少悬停导致的重连，但不作为速度证明。实际 Chromium pointer 进入增加 scrollbars-visible，离开移除；透明度渐变期间即时 opacity 仍为1，不将该快照当作隐藏失败。末列700/600/900px宽度变化的活动身份/焦点/冻结遮挡回归通过。最终262次程序回放横纵覆盖缺口0，Chromium max48.1ms/P95 17.4ms；Safari候选max437ms/P95 77ms、83慢帧。同诊断页面上一版库max431ms/P95 72ms、83慢帧，覆盖也0。小样本未显示候选显著差异，更没有证明 Safari 性能改善；不能直接与上轮92ms比较作为收益或回归结论。

发现拖拽结束闭包可能读旧hover状态，但旧版实际指针对照没有进入gotpointercapture、top未变化，故没有证明问题已复现或修复。新增fixture被动轨迹记录trusted/primary/pointerType/buttons/capture和scrollTop，最多128事件，重启/停止/卸载清理，不改变输入或生产库。原始旧版可信pointerdown和move保存，validDrag false，禁止把它作为拖拽验收通过。此项仍需有效捕获路径验证。

全量verify46/46，最终实际tarball kun-ntable-0.1.0-scrollbar-hover-20261008.tgz严格Bundler/NodeNext和四个导出通过，依赖复用本地树。实验使用上一版JS仅覆盖生成的lib/consumer产物，最终lib已恢复为已验新包相同JS，消费重新构建，Safari已reload最终版本；未回退任何源码工作。git diff --check通过。证据scrollbar-hover-chromium/safari/safari-old-comparison/old-pointer/package-20261008，截图quality-scrollbar-hover.png已检查。性能、真实设备输入和有效拖拽路径仍未完成，目标active。
