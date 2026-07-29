import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_NODE_RADIUS,
  LAYOUT_MIN_NODE_DISTANCE,
  NODE_MIN_WIDTH,
  NODE_MIN_HEIGHT
} from '../config/config';
import {
  getNodeLabelBounds,
  getEdgeLabelBounds,
  labelBoundsOverlap,
  nodeLabelsOverlap,
  overlapArea,
} from '../utils/nodeLabelMetrics';
import { safeParseDSL } from '../utils/jsonParser';
import {
  DSL,
  Edge,
  EdgeType,
  LayoutType,
  Node,
  NodeType,
  Step
} from '../types';
import {
  CATEGORY_WEIGHTS,
  CategoryScore,
  DSLEvalResult,
  EvalCategory,
  EvalGrade,
  EvalIssue,
  IssueSeverity
} from './types';

const VALID_NODE_TYPES: NodeType[] = [
  'vertex', 'concept', 'dataPoint', 'annotation', 'image', 'process', 'event'
];
const VALID_EDGE_TYPES: EdgeType[] = ['straight', 'curve', 'arrow', 'diagonal'];
const VALID_LAYOUT_TYPES: LayoutType[] = ['geometry', 'flow', 'network', 'data'];

const SEVERITY_PENALTY: Record<IssueSeverity, number> = {
  error: 20,
  warning: 8,
  info: 2
};

function issue(
  severity: IssueSeverity,
  category: EvalCategory,
  code: string,
  message: string,
  extra?: Pick<EvalIssue, 'stepIndex' | 'path'>
): EvalIssue {
  return { severity, category, code, message, ...extra };
}

function scoreCategory(category: EvalCategory, issues: EvalIssue[]): CategoryScore {
  const categoryIssues = issues.filter((item) => item.category === category);
  const penalty = categoryIssues.reduce(
    (sum, item) => sum + SEVERITY_PENALTY[item.severity],
    0
  );

  return {
    score: Math.max(0, 100 - penalty),
    weight: CATEGORY_WEIGHTS[category],
    issues: categoryIssues
  };
}

function toGrade(score: number): EvalGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildSummary(result: Omit<DSLEvalResult, 'summary'>): string {
  if (!result.parseable) {
    return 'DSL 无法解析，请先修复 JSON 格式问题。';
  }

  const errors = result.issues.filter((item) => item.severity === 'error').length;
  const warnings = result.issues.filter((item) => item.severity === 'warning').length;

  if (errors === 0 && warnings === 0) {
    return `DSL 质量良好，综合得分 ${result.overallScore}（${result.grade}）。`;
  }

  const weakest = Object.values(result.categories)
    .sort((a, b) => a.score - b.score)[0];

  return `综合得分 ${result.overallScore}（${result.grade}），发现 ${errors} 个错误、${warnings} 个警告；最弱项为 ${weakest.issues[0]?.category ?? 'unknown'}（${weakest.score} 分）。`;
}

function getNodePosition(node: Node): { x: number; y: number } {
  return {
    x: node.x ?? node.pos?.x ?? CANVAS_WIDTH / 2,
    y: node.y ?? node.pos?.y ?? CANVAS_HEIGHT / 2
  };
}

function estimateNodeSize(node: Node): { width: number; height: number } {
  if (node.size?.width && node.size?.height) {
    return { width: node.size.width, height: node.size.height };
  }

  if (node.size?.radius) {
    const diameter = node.size.radius * 2;
    return { width: diameter, height: diameter };
  }

  if (node.type === 'vertex' || node.type === 'dataPoint' || node.type === 'event') {
    const diameter = DEFAULT_NODE_RADIUS * 2;
    return { width: diameter, height: diameter };
  }

  return { width: NODE_MIN_WIDTH, height: NODE_MIN_HEIGHT };
}

function boxesOverlap(a: Node, b: Node): boolean {
  const posA = getNodePosition(a);
  const posB = getNodePosition(b);
  const sizeA = estimateNodeSize(a);
  const sizeB = estimateNodeSize(b);

  const dx = Math.abs(posA.x - posB.x);
  const dy = Math.abs(posA.y - posB.y);
  const minDx = (sizeA.width + sizeB.width) / 2;
  const minDy = (sizeA.height + sizeB.height) / 2;

  return dx < minDx && dy < minDy;
}

function isOutOfBounds(node: Node): boolean {
  const { x, y } = getNodePosition(node);
  const { width, height } = estimateNodeSize(node);

  return (
    x - width / 2 < 0 ||
    x + width / 2 > CANVAS_WIDTH ||
    y - height / 2 < 0 ||
    y + height / 2 > CANVAS_HEIGHT
  );
}

function stepHasAction(step: Step): boolean {
  return Boolean(
    (step.add && step.add.length > 0) ||
    (step.connect && step.connect.length > 0) ||
    (step.remove && step.remove.length > 0) ||
    (step.highlight && step.highlight.length > 0) ||
    (step.timeline && step.timeline.length > 0)
  );
}

function checkPromptCompliance(rawText: string, issues: EvalIssue[]): void {
  if (rawText.includes('```')) {
    issues.push(issue('warning', 'prompt', 'MARKDOWN_FENCE', '输出包含 markdown 代码块标记，违反「只输出 JSON」规则'));
  }

  const trimmed = rawText.trim();
  if (trimmed && !trimmed.startsWith('{')) {
    issues.push(issue('warning', 'prompt', 'NON_JSON_PREFIX', 'JSON 前存在额外文本，可能影响流式解析'));
  }
}

function checkSchema(dsl: DSL, issues: EvalIssue[]): void {
  if (dsl.layoutHints?.type && !VALID_LAYOUT_TYPES.includes(dsl.layoutHints.type)) {
    issues.push(issue(
      'warning',
      'schema',
      'INVALID_LAYOUT_TYPE',
      `未知布局类型: ${dsl.layoutHints.type}`,
      { path: 'layoutHints.type' }
    ));
  }

  dsl.steps.forEach((step, stepIndex) => {
    step.add?.forEach((node, nodeIndex) => {
      const path = `steps[${stepIndex}].add[${nodeIndex}]`;

      if (!node.id) {
        issues.push(issue('error', 'schema', 'MISSING_NODE_ID', '节点缺少 id', { stepIndex, path }));
      }

      if (!node.label || node.label.trim() === '') {
        issues.push(issue('error', 'schema', 'MISSING_NODE_LABEL', '节点缺少 label', { stepIndex, path }));
      }

      if (node.type && !VALID_NODE_TYPES.includes(node.type)) {
        issues.push(issue('warning', 'schema', 'INVALID_NODE_TYPE', `未知节点类型: ${node.type}`, { stepIndex, path }));
      }

      if (node.x === undefined && node.pos?.x === undefined) {
        issues.push(issue('warning', 'prompt', 'MISSING_NODE_X', '节点缺少 x 坐标', { stepIndex, path }));
      }

      if (node.y === undefined && node.pos?.y === undefined) {
        issues.push(issue('warning', 'prompt', 'MISSING_NODE_Y', '节点缺少 y 坐标', { stepIndex, path }));
      }
    });

    step.connect?.forEach((edge, edgeIndex) => {
      const path = `steps[${stepIndex}].connect[${edgeIndex}]`;
      checkEdge(edge, stepIndex, path, issues);
    });
  });
}

function checkEdge(
  edge: Edge,
  stepIndex: number,
  path: string,
  issues: EvalIssue[]
): void {
  if (!edge.from || !edge.to) {
    issues.push(issue('error', 'schema', 'INVALID_EDGE', '边缺少 from 或 to', { stepIndex, path }));
  }

  if (edge.type && !VALID_EDGE_TYPES.includes(edge.type)) {
    issues.push(issue('warning', 'schema', 'INVALID_EDGE_TYPE', `未知边类型: ${edge.type}`, { stepIndex, path }));
  }
}

function checkVisibleLayout(visibleNodes: Node[], stepIndex: number, issues: EvalIssue[]): void {
  visibleNodes.forEach((node) => {
    if (isOutOfBounds(node)) {
      issues.push(issue(
        'warning',
        'layout',
        'NODE_OUT_OF_BOUNDS',
        `节点 "${node.id}" 超出画布范围（${CANVAS_WIDTH}x${CANVAS_HEIGHT}）`,
        { stepIndex, path: `steps[${stepIndex}]` }
      ));
    }
  });

  for (let i = 0; i < visibleNodes.length; i++) {
    for (let j = i + 1; j < visibleNodes.length; j++) {
      const a = visibleNodes[i];
      const b = visibleNodes[j];

      if (boxesOverlap(a, b)) {
        issues.push(issue(
          'warning',
          'layout',
          'NODE_OVERLAP',
          `节点 "${a.id}" 与 "${b.id}" 可能重叠`,
          { stepIndex, path: `steps[${stepIndex}]` }
        ));
      }

      if (nodeLabelsOverlap(a, b)) {
        const areaA = getNodeLabelBounds(a);
        const areaB = getNodeLabelBounds(b);
        const overlap = Math.round(overlapArea(areaA, areaB));
        issues.push(issue(
          'warning',
          'layout',
          'LABEL_OVERLAP',
          `节点 "${a.id}" 与 "${b.id}" 的 label 可能相互覆盖（重叠约 ${overlap}px²）`,
          { stepIndex, path: `steps[${stepIndex}]` }
        ));
      }

      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      const distance = Math.hypot(posA.x - posB.x, posA.y - posB.y);
      if (distance > 0 && distance < LAYOUT_MIN_NODE_DISTANCE) {
        issues.push(issue(
          'info',
          'layout',
          'NODE_TOO_CLOSE',
          `节点 "${a.id}" 与 "${b.id}" 间距过近（${Math.round(distance)}px）`,
          { stepIndex, path: `steps[${stepIndex}]` }
        ));
      }
    }
  }
}

interface VisibleEdge {
  from: string;
  to: string;
  label: string;
  key: string;
}

function checkVisibleEdgeLabels(
  visibleNodes: Node[],
  visibleEdges: VisibleEdge[],
  nodeRegistry: Map<string, Node>,
  stepIndex: number,
  issues: EvalIssue[],
  reportedEdgePairs: Set<string>,
  reportedEdgeNodePairs: Set<string>
): void {
  const labeledEdges = visibleEdges
    .map((edge) => {
      const fromNode = nodeRegistry.get(edge.from);
      const toNode = nodeRegistry.get(edge.to);
      if (!fromNode || !toNode) return null;

      const bounds = getEdgeLabelBounds(
        edge.label,
        getNodePosition(fromNode),
        getNodePosition(toNode)
      );
      if (!bounds) return null;

      return { edge, bounds };
    })
    .filter((item): item is { edge: VisibleEdge; bounds: ReturnType<typeof getEdgeLabelBounds> & object } => Boolean(item));

  for (let i = 0; i < labeledEdges.length; i++) {
    for (let j = i + 1; j < labeledEdges.length; j++) {
      const a = labeledEdges[i];
      const b = labeledEdges[j];
      if (!labelBoundsOverlap(a.bounds, b.bounds)) continue;

      const overlap = Math.round(overlapArea(a.bounds, b.bounds));
      const pairKey = [a.edge.key, b.edge.key].sort().join('|');
      if (reportedEdgePairs.has(pairKey)) continue;
      reportedEdgePairs.add(pairKey);

      issues.push(issue(
        'warning',
        'layout',
        'EDGE_LABEL_OVERLAP',
        `连线 "${a.edge.from}→${a.edge.to}" 与 "${b.edge.from}→${b.edge.to}" 的 label 可能相互覆盖（重叠约 ${overlap}px²）`,
        { stepIndex, path: `steps[${stepIndex}]` }
      ));
    }
  }

  labeledEdges.forEach(({ edge, bounds }) => {
    visibleNodes.forEach((node) => {
      const nodeBounds = getNodeLabelBounds(node);
      if (!labelBoundsOverlap(bounds, nodeBounds)) return;

      const overlap = Math.round(overlapArea(bounds, nodeBounds));
      const pairKey = `${edge.key}|${node.id}`;
      if (reportedEdgeNodePairs.has(pairKey)) return;
      reportedEdgeNodePairs.add(pairKey);

      issues.push(issue(
        'warning',
        'layout',
        'EDGE_NODE_LABEL_OVERLAP',
        `连线 "${edge.from}→${edge.to}" 的 label 可能与节点 "${node.id}" 的 label 相互覆盖（重叠约 ${overlap}px²）`,
        { stepIndex, path: `steps[${stepIndex}]` }
      ));
    });
  });
}

function checkSemantics(dsl: DSL, issues: EvalIssue[]): void {
  const knownNodes = new Set<string>();
  const allAddedNodes = new Map<string, number>();
  const nodeRegistry = new Map<string, Node>();
  const visibleEdges: VisibleEdge[] = [];
  const reportedEdgeLabelPairs = new Set<string>();
  const reportedEdgeNodeLabelPairs = new Set<string>();

  dsl.steps.forEach((step, stepIndex) => {
    if (!stepHasAction(step)) {
      issues.push(issue(
        'warning',
        'pedagogy',
        'EMPTY_STEP_ACTION',
        '该步骤没有任何 add/connect/remove/highlight/timeline 动作',
        { stepIndex, path: `steps[${stepIndex}]` }
      ));
    }

    const addCount = step.add?.length ?? 0;
    if (addCount > 2) {
      issues.push(issue(
        'info',
        'pedagogy',
        'TOO_MANY_NODES_PER_STEP',
        `该步骤添加了 ${addCount} 个节点，建议每步 1-2 个概念`,
        { stepIndex, path: `steps[${stepIndex}].add` }
      ));
    }

    step.add?.forEach((node) => {
      if (!node.id) return;

      if (allAddedNodes.has(node.id)) {
        issues.push(issue(
          'error',
          'semantic',
          'DUPLICATE_NODE_ID',
          `节点 id "${node.id}" 被重复添加`,
          { stepIndex, path: `steps[${stepIndex}].add` }
        ));
      } else {
        allAddedNodes.set(node.id, stepIndex);
      }

      knownNodes.add(node.id);
      nodeRegistry.set(node.id, node);
    });

    step.connect?.forEach((edge) => {
      if (!edge.from || !edge.to) return;

      if (!knownNodes.has(edge.from)) {
        issues.push(issue(
          'error',
          'semantic',
          'DANGLING_EDGE_FROM',
          `边引用了尚未添加的节点 from="${edge.from}"`,
          { stepIndex, path: `steps[${stepIndex}].connect` }
        ));
      }

      if (!knownNodes.has(edge.to)) {
        issues.push(issue(
          'error',
          'semantic',
          'DANGLING_EDGE_TO',
          `边引用了尚未添加的节点 to="${edge.to}"`,
          { stepIndex, path: `steps[${stepIndex}].connect` }
        ));
      }

      if (edge.label?.trim()) {
        visibleEdges.push({
          from: edge.from,
          to: edge.to,
          label: edge.label,
          key: `${edge.from}->${edge.to}@${stepIndex}:${visibleEdges.length}`,
        });
      }
    });

    step.remove?.forEach((nodeId) => {
      if (!knownNodes.has(nodeId)) {
        issues.push(issue(
          'warning',
          'semantic',
          'REMOVE_UNKNOWN_NODE',
          `remove 引用了不存在的节点 "${nodeId}"`,
          { stepIndex, path: `steps[${stepIndex}].remove` }
        ));
      } else {
        knownNodes.delete(nodeId);
        nodeRegistry.delete(nodeId);
      }
    });

    step.highlight?.forEach((nodeId) => {
      if (!knownNodes.has(nodeId)) {
        issues.push(issue(
          'warning',
          'semantic',
          'HIGHLIGHT_UNKNOWN_NODE',
          `highlight 引用了当前不可见的节点 "${nodeId}"`,
          { stepIndex, path: `steps[${stepIndex}].highlight` }
        ));
      }
    });

    step.timeline?.forEach((event, eventIndex) => {
      const path = `steps[${stepIndex}].timeline[${eventIndex}]`;
      if (!event.from || !event.to) {
        issues.push(issue('error', 'schema', 'INVALID_TIMELINE', 'timeline 事件缺少 from 或 to', { stepIndex, path }));
        return;
      }

      if (!knownNodes.has(event.from) || !knownNodes.has(event.to)) {
        issues.push(issue(
          'warning',
          'semantic',
          'TIMELINE_UNKNOWN_NODE',
          `timeline 引用了不可见节点 ${event.from} -> ${event.to}`,
          { stepIndex, path }
        ));
      }
    });

    const visibleNodes = [...knownNodes]
      .map((nodeId) => nodeRegistry.get(nodeId))
      .filter((node): node is Node => Boolean(node));
    checkVisibleLayout(visibleNodes, stepIndex, issues);
    checkVisibleEdgeLabels(
      visibleNodes,
      visibleEdges,
      nodeRegistry,
      stepIndex,
      issues,
      reportedEdgeLabelPairs,
      reportedEdgeNodeLabelPairs
    );
  });
}

function checkPedagogy(dsl: DSL, issues: EvalIssue[]): void {
  const stepCount = dsl.steps.length;

  if (stepCount < 2) {
    issues.push(issue('warning', 'pedagogy', 'TOO_FEW_STEPS', '步骤少于 2 步，难以形成边讲边画节奏'));
  }

  if (stepCount > 12) {
    issues.push(issue('info', 'pedagogy', 'TOO_MANY_STEPS', `步骤较多（${stepCount} 步），可能影响观看体验`));
  }

  const firstStepAdds = dsl.steps[0]?.add?.length ?? 0;
  const totalAdds = dsl.steps.reduce((sum, step) => sum + (step.add?.length ?? 0), 0);

  if (totalAdds > 0 && firstStepAdds / totalAdds > 0.7) {
    issues.push(issue(
      'info',
      'pedagogy',
      'FRONT_LOADED_CONTENT',
      '大部分节点在第一步添加，后续步骤缺乏渐进感',
      { stepIndex: 0 }
    ));
  }

  const emptyTextSteps = dsl.steps.filter((step) => !step.text || step.text.trim() === '').length;
  if (emptyTextSteps > 0) {
    issues.push(issue('error', 'pedagogy', 'EMPTY_STEP_TEXT', `有 ${emptyTextSteps} 个步骤缺少讲解文字`));
  }
}

export function buildEvalResult(
  issues: EvalIssue[],
  parseable: boolean,
  dsl?: DSL
): DSLEvalResult {
  return aggregateResult(issues, parseable, dsl);
}

function aggregateResult(
  issues: EvalIssue[],
  parseable: boolean,
  dsl?: DSL
): DSLEvalResult {
  const categories = {
    parse: scoreCategory('parse', issues),
    schema: scoreCategory('schema', issues),
    semantic: scoreCategory('semantic', issues),
    layout: scoreCategory('layout', issues),
    pedagogy: scoreCategory('pedagogy', issues),
    prompt: scoreCategory('prompt', issues)
  };

  if (!parseable) {
    categories.parse.score = 0;
  }

  const overallScore = parseable
    ? Math.round(
      Object.values(categories).reduce((sum, category) => sum + category.score * category.weight, 0)
    )
    : 0;

  const base: Omit<DSLEvalResult, 'summary'> = {
    parseable,
    overallScore,
    grade: toGrade(overallScore),
    categories,
    issues,
    dsl
  };

  return {
    ...base,
    summary: buildSummary(base)
  };
}

export function evaluateDSLObject(dsl: DSL): DSLEvalResult {
  const issues: EvalIssue[] = [];

  if (!dsl.steps || dsl.steps.length === 0) {
    issues.push(issue('error', 'schema', 'EMPTY_STEPS', 'steps 不能为空'));
    return aggregateResult(issues, true, dsl);
  }

  checkSchema(dsl, issues);
  checkSemantics(dsl, issues);
  checkPedagogy(dsl, issues);

  return aggregateResult(issues, true, dsl);
}

export function evaluateDSL(rawText: string): DSLEvalResult {
  const issues: EvalIssue[] = [];
  checkPromptCompliance(rawText, issues);

  const parsed = safeParseDSL(rawText);
  if (!parsed.success || !parsed.data) {
    issues.push(issue(
      'error',
      'parse',
      'PARSE_FAILED',
      parsed.error ?? '无法解析 DSL JSON'
    ));

    parsed.errors?.slice(1).forEach((message) => {
      issues.push(issue('error', 'parse', 'PARSE_DETAIL', message));
    });

    return aggregateResult(issues, false);
  }

  const objectResult = evaluateDSLObject(parsed.data);
  return aggregateResult([...issues, ...objectResult.issues], true, parsed.data);
}

export function formatEvalReport(result: DSLEvalResult): string {
  const lines = [
    `DSL Evaluation Report`,
    `====================`,
    `Score: ${result.overallScore}/100 (${result.grade})`,
    `Parseable: ${result.parseable ? 'yes' : 'no'}`,
  ];

  if (result.dsl?.title) {
    lines.push(`Title: ${result.dsl.title}`);
  }

  if (result.dsl?.steps) {
    lines.push(`Steps: ${result.dsl.steps.length}`);
  }

  lines.push('', result.summary, '', 'Categories:');

  Object.entries(result.categories).forEach(([name, category]) => {
    lines.push(`- ${name}: ${category.score}/100 (weight ${Math.round(category.weight * 100)}%)`);
  });

  if (result.issues.length > 0) {
    lines.push('', 'Issues:');
    result.issues.forEach((item, index) => {
      const location = item.stepIndex !== undefined ? ` @ step ${item.stepIndex + 1}` : '';
      lines.push(`${index + 1}. [${item.severity}] ${item.code}${location}: ${item.message}`);
    });
  }

  return lines.join('\n');
}
