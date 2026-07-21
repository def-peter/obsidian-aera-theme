---
status: active
topics:
  - obsidian
  - theme
published: 2026-07-16
---

# Aera 主题演练场

中文排版与少量 English typography 应当保持协调。

正文包含普通文字、**粗体文字**、*斜体文字*、==高亮文字== 与 `行内代码`。

## 链接

已解析链接：[[Embedded Note]]
未解析链接：[[Missing Note]]
外部链接：[Obsidian](https://obsidian.md)

### 列表与引用

> 第一行引用，用于检查纸张折角。
> 第二行引用，用于检查连续卡片。
> > 嵌套引用只保留外层折角。

1. 有序列表项
   1. 嵌套有序列表项
2. 另一个有序列表项

- 无序列表项
  - 嵌套无序列表项
- 另一个无序列表项

- [x] 已完成任务
- [ ] 待完成任务

#### 代码

```javascript
// Monokai syntax coverage
const accent = "#1677FF";
function renderTheme(name, retries = 3) {
  return `${name}:${retries}`;
}
renderTheme("Aera");
const horizontalScroll = "This intentionally long JavaScript line verifies horizontal scrolling without wrapping in the Aera code block playground.";
```

```
无语言代码块用于检查普通文本。
```

---

##### 标注框

> [!note] 提示
> 这是一条平静的补充信息。

> [!abstract] 摘要
> 摘要信息用于检查纸页图形。

> [!info] 信息
> 信息内容用于检查环形标记。

> [!todo] 待办
> 待办内容用于检查手写清单。

> [!tip] 灵感
> 灵感内容用于检查星芒图形。

> [!success] 完成
> 完成内容用于检查生长与确认状态。

> [!question] 问题
> 问题内容用于检查开放状态。

> [!warning] 警告
> 此处内容需要重点关注。

> [!failure] 失败
> 失败内容用于检查中断状态。

> [!error] 错误
> 错误信息用于检查高优先级状态。

> [!bug] 缺陷
> 缺陷内容用于检查技术问题状态。

> [!example] 示例
> 示例内容用于检查独立信息层级。

> [!quote] 引用
> 引用标注用于检查长文摘录。

> [!tip]- 收起的提示
> 折叠内容用于检查关闭状态。

> [!custom] 自定义回退
> 未映射类型应继续显示 Obsidian 原生图标。

###### 表格、标签、嵌入与脚注

| 元素 | 状态 | 用途 |
| --- | --- | --- |
| 链接 | 已解析 | 导航 |
| 任务 | 待完成 | 交互 |

#Aera主题 #视觉检查

![[Embedded Note]]

演练场以脚注引用结束。[^aera]

[^aera]: Aera 是用于检查 Obsidian 主题的演练 fixture。

<!-- Aera fixture managed by obsidian-aera-theme. -->
