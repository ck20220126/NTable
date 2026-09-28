# 通用 Button

源码：`app/src/components/Button.tsx`。用于创建 / 保存 / 取消、添加记录、添加条件、清空及普通图标操作。视图标签、菜单项、选择器、树展开、字段显隐和表头等专用控件保留各自实现，不套用通用 Button。训练场不在本次替换范围。

```tsx
import { Button } from "./components";
import { Plus } from "lucide-react";

<Button variant="contained" color="primary" onClick={save}>保存</Button>
<Button variant="outlined" onClick={close}>取消</Button>
<Button variant="text" color="primary" size="small" icon={<Plus size={14} />}>
  添加筛选条件
</Button>
<Button iconOnly size="small" aria-label="添加记录" icon={<Plus size={16} />} />
<Button variant="contained" color="primary" loading>提交中</Button>
```

| 属性 | 可选值 / 类型 | 默认值 |
| --- | --- | --- |
| variant | contained、outlined、text | text |
| color | default、primary、danger | default |
| size | small、medium、large | medium |
| icon | ReactNode，文字前图标 | 无 |
| iconOnly | boolean，正方形图标按钮 | false |
| loading | boolean，显示 spinner、禁止点击、设置 aria-busy | false |
| block | boolean，铺满容器宽度 | false |
| disabled | 原生禁用 | false |
| type | button、submit、reset | button |

同时支持原生 button 属性、children、style、className、事件及 HTMLButtonElement ref。纯图标按钮必须提供 aria-label。支持 Radix Trigger 的 asChild，透传其事件及 data / aria 属性。

尺寸：small 28px / 12px 字号，medium 32px / 14px，large 40px / 16px；圆角 6px。已有表头、视图菜单等紧凑场景保留各自布局尺寸。工具栏数据激活的彩色背景由工具栏样式管理，不以 Button 的 loading 或 focus 代替。

文字按钮 hover 显示浅灰背景。主按钮沿用实测飞书蓝色：默认 #1456f0、hover #336df4、按下 #0442d2；禁用使用 #bbbfc4。组件自动引入 Button.css，业务系统还需正确引入表格场景样式。
