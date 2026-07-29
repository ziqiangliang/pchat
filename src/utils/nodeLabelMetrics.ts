import {
  NODE_PADDING,
  NODE_MIN_WIDTH,
  NODE_MAX_WIDTH,
  NODE_MIN_HEIGHT,
  NODE_MAX_HEIGHT,
  NODE_DEFAULT_HEIGHT,
  NODE_LINE_HEIGHT_RATIO,
  NODE_CHAR_WIDTH_CHINESE,
  NODE_CHAR_WIDTH_ENGLISH,
  DEFAULT_NODE_RADIUS,
} from '../config/config';
import { Node, NODE_STYLES, NodeType } from '../types';

/** 与 GraphCanvas renderEdge 中边 label 样式一致 */
export const EDGE_LABEL_FONT_SIZE = 12;
export const EDGE_LABEL_Y_OFFSET = 10;

function isChineseChar(char: string): boolean {
  return /[\u4e00-\u9fa5]/.test(char);
}

export function calculateTextWidth(label: string, fontSize: number): number {
  if (!label) return 0;

  let textWidth = 0;
  for (const char of label) {
    if (isChineseChar(char)) {
      textWidth += fontSize * NODE_CHAR_WIDTH_CHINESE;
    } else {
      textWidth += fontSize * NODE_CHAR_WIDTH_ENGLISH;
    }
  }

  return textWidth;
}

export function calculateNodeWidth(label: string, fontSize: number): number {
  if (!label) return NODE_MIN_WIDTH;

  const textWidth = calculateTextWidth(label, fontSize);
  const width = textWidth + NODE_PADDING * 2;

  return Math.max(NODE_MIN_WIDTH, Math.min(width, NODE_MAX_WIDTH));
}

export function calculateNodeHeight(label: string, fontSize: number): number {
  if (!label) return NODE_DEFAULT_HEIGHT;

  const lineHeight = fontSize * NODE_LINE_HEIGHT_RATIO;
  const textWidth = calculateTextWidth(label, fontSize);
  const singleLineWidth = textWidth + NODE_PADDING * 2;

  if (singleLineWidth <= NODE_MAX_WIDTH) {
    const height = lineHeight + NODE_PADDING * 2;
    return Math.max(NODE_MIN_HEIGHT, Math.min(height, NODE_MAX_HEIGHT));
  }

  const avgCharWidth = fontSize * 0.8;
  const usableWidth = NODE_MAX_WIDTH - NODE_PADDING * 2;
  const charsPerLine = Math.max(1, Math.floor(usableWidth / avgCharWidth));
  const lines = Math.ceil(label.length / charsPerLine);

  const height = lines * lineHeight + NODE_PADDING * 2;

  return Math.max(NODE_MIN_HEIGHT, Math.min(height, NODE_MAX_HEIGHT));
}

export interface LabelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export function getNodeLabelBounds(node: Node, position?: { x: number; y: number }): LabelBounds {
  const pos = position ?? {
    x: node.x ?? node.pos?.x ?? 0,
    y: node.y ?? node.pos?.y ?? 0,
  };

  const nodeType: NodeType = node.type || 'concept';
  const style = NODE_STYLES[nodeType];
  const label = node.label || '';

  let width: number;
  let height: number;

  if (node.size?.width && node.size?.height) {
    width = node.size.width;
    height = node.size.height;
  } else {
    width = calculateNodeWidth(label, style.fontSize);
    height = calculateNodeHeight(label, style.fontSize);
  }

  // 圆形节点本体较小，但 label 按文字包围盒渲染，与 GraphCanvas 一致
  if (style.shape === 'circle' && !node.size?.width) {
    const minSide = Math.max(width, DEFAULT_NODE_RADIUS * 2);
    width = Math.max(width, minSide);
    height = Math.max(height, minSide);
  }

  const textCenterY = pos.y + style.fontSize / 3;

  return {
    left: pos.x - width / 2,
    right: pos.x + width / 2,
    top: textCenterY - height / 2,
    bottom: textCenterY + height / 2,
    width,
    height,
  };
}

export function labelBoundsOverlap(
  a: LabelBounds,
  b: LabelBounds,
  padding = 4
): boolean {
  return !(
    a.right + padding <= b.left ||
    b.right + padding <= a.left ||
    a.bottom + padding <= b.top ||
    b.bottom + padding <= a.top
  );
}

export function nodeLabelsOverlap(a: Node, b: Node, padding = 4): boolean {
  const boundsA = getNodeLabelBounds(a);
  const boundsB = getNodeLabelBounds(b);
  return labelBoundsOverlap(boundsA, boundsB, padding);
}

export function overlapArea(a: LabelBounds, b: LabelBounds): number {
  const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (overlapWidth <= 0 || overlapHeight <= 0) return 0;
  return overlapWidth * overlapHeight;
}

export function getEdgeLabelBounds(
  label: string,
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
  fontSize = EDGE_LABEL_FONT_SIZE,
  yOffset = EDGE_LABEL_Y_OFFSET
): LabelBounds | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;
  const baselineY = midY - yOffset;
  const width = calculateTextWidth(trimmed, fontSize);
  const height = fontSize * NODE_LINE_HEIGHT_RATIO;

  return {
    left: midX - width / 2,
    right: midX + width / 2,
    top: baselineY - height * 0.85,
    bottom: baselineY + height * 0.15,
    width,
    height,
  };
}
