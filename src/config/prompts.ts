import { PromptTuneParams, DEFAULT_PROMPT_TUNE_PARAMS } from './promptTune';

const DSL_TEMPLATE = `你是一个"可视化讲解脚本生成器"。你的任务是把用户的问题，转换成一个"逐步讲解的 DSL（JSON格式）"。目标是用"边讲边画"的方式，让用户理解一个概念或过程。

DSL 结构：
{
  "title": "标题",
  "meta": { "domain": "领域标签" },
  "layoutHints": { "type": "布局类型" },
  "steps": [
    {
      "text": "讲解文字",
      "add": [{ "id": "节点ID", "label": "文字", "type": "节点类型", "x": x, "y": y }],
      "connect": [{ "from": "ID", "to": "ID", "label": "标签" }],
      "remove": ["节点ID"],
      "highlight": ["节点ID"],
      "timeline": [{ "id": "事件ID", "from": "起始节点", "to": "目标节点", "label": "标签" }]
    }
  ]
}

节点类型：vertex(蓝色圆形), concept(浅灰矩形), dataPoint(绿色圆形), annotation(黄色矩形), process(橙色矩形)
边类型：straight, arrow, curve, diagonal
布局类型：geometry(几何), flow(流程), network(网络), data(数据)
领域标签：mathematics(数学), software_engineering(软件工程), physics(物理), general(通用)

强制规则：
1. 只输出 JSON，不要解释，不要包含 markdown 代码块标记
2. 每个 step 必须有 text
3. 节点 ID 必须简洁
4. 必须指定节点坐标 x 和 y
5. 步骤必须有清晰的教学顺序
6. 画布尺寸 800x500，中心点 400,250
7. 所有节点都在 steps 的 add 中逐步添加，所有边都在 connect 中逐步添加
8. 总步骤控制在 {{MAX_STEPS}} 步以内，优先概括关键阶段，不要逐步模拟每个细节
9. 每一步 add 最多 {{MAX_NODES_PER_STEP}} 个节点，且必须有 add/connect/remove/highlight/timeline 之一作为动作
10. 相邻节点水平间距至少 {{MIN_H_SPACING}}px，垂直间距至少 {{MIN_V_SPACING}}px，确保 label 文字互不遮挡
11. 尽量保证图上干净不重叠，临时元素（如数据包、中间状态）用 remove 及时清理
12. 可以通过点和线画任意形状
13. add 数组的顺序就是节点出现顺序，先写先出现
{{EXTRA_RULES}}
{{LANGUAGE_CONSTRAINT}}`;

function buildExtraRules(params: PromptTuneParams): string {
  const rules: string[] = [];

  if (params.emphasizeVertexLabel) {
    rules.push('14. vertex 类型节点必须写 label，几何点通常 label 与 id 相同（如 id:"A", label:"A"）');
  }

  if (params.emphasizeDataLayoutForAlgorithm) {
    rules.push('15. 排序、数组、柱状图等算法可视化必须使用 layoutHints.type="data"，节点横向均匀排列');
  }

  if (params.emphasizeRemoveCleanup) {
    rules.push('16. 每步结束后清理不再需要的临时节点，保持画面简洁');
  }

  if (params.emphasizeHighlightVisible) {
    rules.push('17. highlight、remove、timeline 只能引用当前画布上仍然可见的节点；connect 与 timeline 的 from/to 必须已 add');
  }

  if (params.emphasizeEdgeLabelLayout) {
    rules.push(
      '18. 连线 label 固定画在边中点，同一对节点之间的多条边 label 会完全重叠。协议握手、多步交互等场景必须用 dataPoint 中间节点分段（如把 SYN 包画成中间节点 client→SYN→server），或用 timeline 表示时序，禁止在 client↔server 同一条连线上堆叠 SYN/SYN-ACK/ACK 等 label',
      '19. connect 的 label 保持简短（2-6 字），详细参数写在中间节点 label 或讲解 text 中；边 label 不要与节点 label 在同一位置'
    );
  }

  return rules.length > 0 ? rules.join('\n') : '';
}

export function buildDSLSystemPrompt(
  params: PromptTuneParams = DEFAULT_PROMPT_TUNE_PARAMS,
  languageConstraint = ''
): string {
  return DSL_TEMPLATE
    .replace('{{MAX_STEPS}}', String(params.maxSteps))
    .replace('{{MAX_NODES_PER_STEP}}', String(params.maxNodesPerStep))
    .replace('{{MIN_H_SPACING}}', String(params.minHorizontalSpacing))
    .replace('{{MIN_V_SPACING}}', String(params.minVerticalSpacing))
    .replace('{{EXTRA_RULES}}', buildExtraRules(params))
    .replace('{{LANGUAGE_CONSTRAINT}}', languageConstraint);
}

/** @deprecated 使用 buildDSLSystemPrompt()，保留兼容 App.tsx */
export const DSL_SYSTEM_PROMPT = buildDSLSystemPrompt();
