# DSL 设计文档

## 1. 概述

DSL (Domain-Specific Language) 是 PChat 项目中用于描述可视化图形和交互流程的专用语言。它采用 JSON 格式，定义了如何通过文本描述生成图形化内容，支持边讲边画的交互方式。

## 2. 核心结构

```json
{
  "title": "标题",
  "meta": { "domain": "领域标签" },
  "nodes": [
    {
      "id": "节点ID",
      "label": "显示文字",
      "type": "节点类型",
      "x": 100,
      "y": 100,
      "style": { "color": "文字颜色", "fill": "背景颜色", "border": "边框颜色" }
    }
  ],
  "edges": [
    {
      "from": "起始节点ID",
      "to": "目标节点ID",
      "label": "连线标签（可选）",
      "type": "连线类型"
    }
  ],
  "layoutHints": {
    "type": "布局类型",
    "geometryType": "几何类型（可选）",
    "constraints": [ { "type": "约束类型", "nodes": ["节点ID列表"] } ]
  },
  "steps": [
    {
      "text": "讲解文字",
      "add": [{ "id": "节点ID", "label": "文字", "type": "节点类型" }],
      "connect": [{ "from": "ID", "to": "ID", "label": "标签" }],
      "highlight": ["节点ID"]
    }
  ]
}
```

## 3. 节点类型 (NodeType)

| 类型 | 描述 | 样式 | 形状 |
|------|------|------|------|
| vertex | 几何顶点（如 A, B, C, D） | 蓝色圆形 | 圆形 |
| concept | 概念节点（如 函数、变量、数据结构） | 浅灰矩形 | 矩形 |
| dataPoint | 数据点、输入输出 | 绿色圆形 | 圆形 |
| annotation | 标注（如角度、边长、标签） | 黄色矩形 | 矩形 |
| image | 图像节点 | 淡紫色矩形 | 矩形 |
| process | 流程步骤、处理过程 | 橙色矩形 | 矩形 |
| event | 事件节点 | 粉色圆形 | 圆形 |

### 3.1 节点属性

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| id | string | 是 | 节点唯一标识 |
| label | string | 是 | 节点显示文本 |
| type | NodeType | 否 | 节点类型 |
| x | number | 否 | 节点 X 坐标 |
| y | number | 否 | 节点 Y 坐标 |
| pos | Position | 否 | 节点位置对象 {x, y} |
| size | Size | 否 | 节点大小 {width, height, radius} |
| style | NodeStyle | 否 | 节点样式 |
| domain | string | 否 | 领域标签 |
| target | AnnotationTarget | 否 | 标注目标（仅 annotation 节点使用） |

### 3.2 标注目标 (AnnotationTarget)

```json
{
  "type": "node", // 目标类型：node, edge, angle
  "nodeId": "A", // 目标节点 ID
  "position": "top" // 位置：top, bottom, left, right, auto
}
```

## 4. 边类型 (EdgeType)

| 类型 | 描述 |
|------|------|
| straight | 直线连接 - 直接连接两个节点 |
| curve | 曲线连接 - 用于避免交叉 |
| arrow | 箭头连接 - 表示方向、流程、数据流 |
| diagonal | 对角线 - 用于几何图形 |

### 4.1 边属性

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| from | string | 是 | 起始节点 ID |
| to | string | 是 | 目标节点 ID |
| label | string | 否 | 边标签 |
| type | EdgeType | 否 | 边类型 |
| style | object | 否 | 边样式 {color, width, dashed} |

## 5. 布局类型 (LayoutType)

| 类型 | 描述 | 适用场景 |
|------|------|----------|
| geometry | 几何布局 | 数学证明、几何图形 |
| flow | 流程布局 | 步骤流程、算法流程 |
| network | 网络布局 | 关系图、依赖图、概念图 |
| data | 数据布局 | 图表、数据展示 |

### 5.1 布局约束 (Constraint)

| 类型 | 描述 | 适用场景 |
|------|------|----------|
| equalLength | 所有边长度相等 | 几何图形 |
| rightAngle | 直角关系 | 几何图形 |
| diagonalIntersect | 对角线相交于中点 | 几何图形 |
| parallel | 平行边 | 几何图形 |
| perpendicular | 垂直边 | 几何图形 |
| group | 分组排列 | 网络布局 |
| center | 中心节点 | 网络布局 |
| horizontal | 水平对齐 | 流程布局、数据布局 |
| vertical | 垂直对齐 | 流程布局、数据布局 |

## 6. 步骤 (Step)

步骤是 DSL 的核心，用于定义边讲边画的过程。每个步骤可以包含文本描述和图形操作。

### 6.1 步骤属性

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| text | string | 是 | 讲解文字 |
| add | Node[] | 否 | 添加节点 |
| connect | Edge[] | 否 | 连接节点 |
| remove | string[] | 否 | 移除节点 |
| highlight | string[] | 否 | 高亮节点 |
| animate | object | 否 | 动画配置 {type, target, duration} |
| timeline | TimelineEvent[] | 否 | 时间线事件 |

### 6.2 动画类型 (AnimationType)

| 类型 | 描述 |
|------|------|
| fade | 淡入淡出效果 |
| move | 移动效果 |
| scale | 缩放效果 |
| draw | 绘制效果 |

### 6.3 时间线事件 (TimelineEvent)

用于描述往返通信、数据包传输、时序流程等场景。

```json
{
  "id": "t1",
  "from": "client",
  "to": "server",
  "label": "SYN",
  "direction": "forward",
  "color": "#ec4899",
  "delay": 100
}
```

## 7. 元数据 (Meta)

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| title | string | 否 | 标题 |
| domain | string | 否 | 领域标签 |

## 8. 样式系统

### 8.1 节点样式 (NodeStyle)

| 属性 | 类型 | 描述 |
|------|------|------|
| color | string | 文字颜色 |
| border | string | 边框颜色 |
| font | string | 字体 |
| opacity | number | 透明度 |
| fill | string | 填充颜色 |

### 8.2 默认样式

系统为每种节点类型提供了默认样式，可通过 `style` 属性覆盖。

## 9. 最佳实践

1. **从简单到复杂**：逐步构建图形，每一步只引入一个新概念
2. **清晰的步骤顺序**：确保步骤之间逻辑连贯，符合教学顺序
3. **合理的节点命名**：使用简洁、有意义的节点 ID
4. **适当的布局**：根据内容选择合适的布局类型
5. **充分利用动画**：使用动画效果增强讲解效果
6. **时间线事件**：描述通信流程时使用 timeline 而非 edge

## 10. 示例

### 10.1 函数概念示例

```json
{
  "title": "函数的基本概念",
  "meta": { "domain": "mathematics" },
  "nodes": [
    { "id": "x", "label": "输入 x", "type": "dataPoint", "x": 150, "y": 250 },
    { "id": "f", "label": "f()", "type": "concept", "x": 400, "y": 250 },
    { "id": "y", "label": "输出 y", "type": "dataPoint", "x": 650, "y": 250 }
  ],
  "edges": [
    { "from": "x", "to": "f", "label": "处理", "type": "arrow" },
    { "from": "f", "to": "y", "type": "arrow" }
  ],
  "steps": [
    { "text": "我们先看一个输入 x", "add": [{ "id": "x", "label": "输入 x", "type": "dataPoint", "x": 150, "y": 250 }] },
    { "text": "函数 f 会处理这个输入", "add": [{ "id": "f", "label": "f()", "type": "concept", "x": 400, "y": 250 }], "connect": [{ "from": "x", "to": "f", "label": "处理", "type": "arrow" }] },
    { "text": "处理后得到输出 y", "add": [{ "id": "y", "label": "输出 y", "type": "dataPoint", "x": 650, "y": 250 }], "connect": [{ "from": "f", "to": "y", "type": "arrow" }] },
    { "text": "这就是函数：输入 → 处理 → 输出", "highlight": ["f"] }
  ]
}
```

### 10.2 正方形性质示例

```json
{
  "title": "正方形的性质",
  "meta": { "domain": "mathematics" },
  "nodes": [
    { "id": "A", "label": "A", "type": "vertex", "x": 250, "y": 150 },
    { "id": "B", "label": "B", "type": "vertex", "x": 550, "y": 150 },
    { "id": "C", "label": "C", "type": "vertex", "x": 550, "y": 350 },
    { "id": "D", "label": "D", "type": "vertex", "x": 250, "y": 350 },
    { "id": "lengthAB", "label": "5cm", "type": "annotation", "x": 400, "y": 130, "target": { "nodeId": "A" } },
    { "id": "angleA", "label": "90°", "type": "annotation", "x": 230, "y": 150, "target": { "nodeId": "A" } }
  ],
  "edges": [
    { "from": "A", "to": "B", "label": "边" },
    { "from": "B", "to": "C", "label": "边" },
    { "from": "C", "to": "D", "label": "边" },
    { "from": "D", "to": "A", "label": "边" }
  ],
  "steps": [
    { "text": "画四个顶点 A、B、C、D", "add": [
      { "id": "A", "label": "A", "type": "vertex", "x": 250, "y": 150 },
      { "id": "B", "label": "B", "type": "vertex", "x": 550, "y": 150 },
      { "id": "C", "label": "C", "type": "vertex", "x": 550, "y": 350 },
      { "id": "D", "label": "D", "type": "vertex", "x": 250, "y": 350 }
    ]},
    { "text": "依次连接各边", "connect": [
      { "from": "A", "to": "B", "label": "边" },
      { "from": "B", "to": "C", "label": "边" },
      { "from": "C", "to": "D", "label": "边" },
      { "from": "D", "to": "A", "label": "边" }
    ]},
    { "text": "标注一条边的长度", "add": [{ "id": "lengthAB", "label": "5cm", "type": "annotation", "x": 400, "y": 130 }] },
    { "text": "正方形的特点是四个角都是直角", "add": [{ "id": "angleA", "label": "90°", "type": "annotation", "x": 230, "y": 150 }] }
  ]
}
```

## 11. 流式处理支持

DSL 设计支持流式处理，允许在接收完整 JSON 前开始解析和执行步骤。每个步骤都是独立的操作单元，可以按照顺序逐步执行，实现边讲边画的效果。

### 11.1 流式处理优势

- **减少等待时间**：用户无需等待完整响应即可看到图形开始生成
- **实时反馈**：边接收数据边渲染，提供即时视觉反馈
- **更好的用户体验**：模拟真实的讲解过程，一步一步构建理解

### 11.2 实现建议

1. **增量 JSON 解析**：实现可以处理不完整 JSON 的解析器
2. **步骤预加载**：解析到 steps 数组时立即开始执行已解析的步骤
3. **状态同步**：确保流式数据的状态与前端渲染状态保持同步
4. **错误处理**：处理 JSON 格式错误和不完整数据的情况

## 12. 版本控制

DSL 设计采用版本控制机制，确保向后兼容性。当前版本为 v1.0，后续版本会在保持核心结构不变的基础上进行扩展。

## 13. 扩展建议

1. **自定义节点类型**：支持用户定义新的节点类型和样式
2. **高级动画效果**：增加更多动画类型和配置选项
3. **交互功能**：支持用户与图形的交互，如点击、拖拽等
4. **数据可视化**：增加对图表、数据展示的支持
5. **多语言支持**：支持国际化和多语言标注

---

本设计文档基于 PChat 项目的实际实现，旨在为开发者和 AI 模型提供清晰的 DSL 结构参考。