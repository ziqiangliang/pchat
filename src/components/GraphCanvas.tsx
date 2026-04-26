import React, { useMemo, memo, useCallback } from 'react';
import { Node, Edge, Position, DSL, AnimationType, TimelineEvent, NODE_STYLES, MathCanvas, MathPoint, MathLine, MathCurve } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  NODE_ANIMATION_DURATION,
  ANNOTATION_OFFSET,
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
  COORD_DEFAULT_ORIGIN_X,
  COORD_DEFAULT_ORIGIN_Y,
  COORD_DEFAULT_UNIT_SIZE,
  COORD_DEFAULT_RANGE_X,
  COORD_DEFAULT_RANGE_Y
} from '../config';
import { layoutOptimizer } from '../engines/layoutOptimizer';
import { useCanvasGesture } from '../hooks/useCanvasGesture';

function isChineseChar(char: string): boolean {
  return /[\u4e00-\u9fa5]/.test(char);
}

function calculateTextWidth(label: string, fontSize: number): number {
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

function calculateNodeWidth(label: string, fontSize: number): number {
  if (!label) return NODE_MIN_WIDTH;

  const textWidth = calculateTextWidth(label, fontSize);
  const width = textWidth + NODE_PADDING * 2;

  return Math.max(NODE_MIN_WIDTH, width);
}

function calculateNodeHeight(label: string, fontSize: number): number {
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

/** 将数学坐标转换为 SVG 像素坐标 */
function dataToSvg(dataX: number, dataY: number, mc: MathCanvas): Position {
  const originX = mc.origin?.x ?? COORD_DEFAULT_ORIGIN_X;
  const originY = mc.origin?.y ?? COORD_DEFAULT_ORIGIN_Y;
  const unitSize = mc.unitSize ?? COORD_DEFAULT_UNIT_SIZE;
  return {
    x: originX + dataX * unitSize,
    y: originY - dataY * unitSize,
  };
}

/** 将数学线段延伸到坐标系边界 */
function extendLineToRange(p1: Position, p2: Position, mc: MathCanvas): { from: Position; to: Position } {
  const originX = mc.origin?.x ?? COORD_DEFAULT_ORIGIN_X;
  const originY = mc.origin?.y ?? COORD_DEFAULT_ORIGIN_Y;
  const unitSize = mc.unitSize ?? COORD_DEFAULT_UNIT_SIZE;
  const [xMin, xMax] = mc.rangeX ?? COORD_DEFAULT_RANGE_X;
  const [yMin, yMax] = mc.rangeY ?? COORD_DEFAULT_RANGE_Y;

  const svgXMin = originX + xMin * unitSize;
  const svgXMax = originX + xMax * unitSize;
  const svgYTop = originY - yMax * unitSize;
  const svgYBottom = originY - yMin * unitSize;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (Math.abs(dx) < 0.001) {
    // 垂直线
    return { from: { x: p1.x, y: svgYTop }, to: { x: p1.x, y: svgYBottom } };
  }
  if (Math.abs(dy) < 0.001) {
    // 水平线
    return { from: { x: svgXMin, y: p1.y }, to: { x: svgXMax, y: p1.y } };
  }

  const slope = dy / dx;
  const intercept = p1.y - slope * p1.x;

  const candidates: Position[] = [];
  // 与四条边界的交点
  const yAtXMin = slope * svgXMin + intercept;
  if (yAtXMin >= svgYTop && yAtXMin <= svgYBottom) candidates.push({ x: svgXMin, y: yAtXMin });
  const yAtXMax = slope * svgXMax + intercept;
  if (yAtXMax >= svgYTop && yAtXMax <= svgYBottom) candidates.push({ x: svgXMax, y: yAtXMax });
  const xAtYTop = (svgYTop - intercept) / slope;
  if (xAtYTop >= svgXMin && xAtYTop <= svgXMax) candidates.push({ x: xAtYTop, y: svgYTop });
  const xAtYBottom = (svgYBottom - intercept) / slope;
  if (xAtYBottom >= svgXMin && xAtYBottom <= svgXMax) candidates.push({ x: xAtYBottom, y: svgYBottom });

  if (candidates.length >= 2) {
    candidates.sort((a, b) => a.x - b.x);
    return { from: candidates[0], to: candidates[candidates.length - 1] };
  }
  return { from: p1, to: p2 };
}

interface GraphCanvasProps {
  dsl: DSL | null;
  nodes: Map<string, Node>;
  edges: Edge[];
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  highlightedNodes: Set<string>;
  highlightedEdges: Set<string>;
  nodeAnimations: Map<string, AnimationType>;
  edgeAnimations: Map<string, AnimationType>;
  activeTimelineEvents: TimelineEvent[];
  timelineAnimations: Map<string, { progress: number }>;
  currentText: string;
  currentStep: number;
  // 数学层
  coordVisible: boolean;
  mathPoints: Map<string, MathPoint>;
  mathLines: Map<string, MathLine>;
  mathCurves: Map<string, MathCurve>;
  visibleMathIds: Set<string>;
  mathAnimations: Map<string, AnimationType>;
  highlightedMathIds: Set<string>;
}

const GraphCanvasComponent: React.FC<GraphCanvasProps> = ({
  dsl,
  nodes,
  edges,
  visibleNodeIds,
  visibleEdgeIds,
  highlightedNodes,
  highlightedEdges,
  nodeAnimations,
  edgeAnimations,
  activeTimelineEvents,
  timelineAnimations,
  currentText,
  currentStep,
  coordVisible,
  mathPoints,
  mathLines,
  mathCurves,
  visibleMathIds,
  mathAnimations,
  highlightedMathIds
}) => {
  const {
    viewport,
    containerRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    zoomIn,
    zoomOut,
    resetViewport,
    fitToView
  } = useCanvasGesture(CANVAS_WIDTH, CANVAS_HEIGHT);

  const nodesKey = useMemo(() => {
    if (!nodes || nodes.size === 0) return '';
    const nodeData = Array.from(nodes.entries()).map(([id, node]) => 
      `${id}:${node.label}:${node.type}:${node.x}:${node.y}`
    ).join('|');
    return nodeData;
  }, [nodes]);

  const edgesKey = useMemo(() => {
    if (!edges || edges.length === 0) return '';
    return edges.map(e => `${e.from}-${e.to}`).join('|');
  }, [edges]);

  const positions = useMemo(() => {
    const allNodes = nodes ? Array.from(nodes.values()) : [];
    const posMap = new Map<string, Position>();

    if (!Array.isArray(allNodes) || allNodes.length === 0) {
      return posMap;
    }

    // 节点层始终使用 layoutOptimizer（像素坐标）
    const optimizedPositions = layoutOptimizer.optimize(allNodes, edges);
    optimizedPositions.forEach((pos, id) => {
      posMap.set(id, pos);
    });

    // annotation 节点位置计算
    allNodes
      .filter(node => node && node.type === 'annotation' && node.target)
      .forEach(annotation => {
        if (!annotation || !annotation.id) return;
        if (annotation.x !== undefined && annotation.y !== undefined) return;

        const target = annotation.target!;
        if (target && target.nodeId) {
          const targetPos = posMap.get(target.nodeId);
          if (targetPos) {
            const dx = target.dx || 0;
            const dy = target.dy || -ANNOTATION_OFFSET;
            posMap.set(annotation.id, {
              x: targetPos.x + dx,
              y: targetPos.y + dy
            });
          }
        }
      });

    return posMap;
  }, [nodesKey, edgesKey, nodes, edges]);

  /** 渲染坐标系网格+轴 */
  const renderCoordinateSystem = useCallback(() => {
    if (!coordVisible || !dsl?.mathCanvas) return null;

    const mc = dsl.mathCanvas;
    const originX = mc.origin?.x ?? COORD_DEFAULT_ORIGIN_X;
    const originY = mc.origin?.y ?? COORD_DEFAULT_ORIGIN_Y;
    const unitSize = mc.unitSize ?? COORD_DEFAULT_UNIT_SIZE;
    const [xMin, xMax] = mc.rangeX ?? COORD_DEFAULT_RANGE_X;
    const [yMin, yMax] = mc.rangeY ?? COORD_DEFAULT_RANGE_Y;
    const showGrid = mc.showGrid !== false;
    const showLabels = mc.showLabels !== false;
    const xLabel = mc.xLabel ?? 'x';
    const yLabel = mc.yLabel ?? 'y';

    const svgXMin = originX + xMin * unitSize;
    const svgXMax = originX + xMax * unitSize;
    const svgYTop = originY - yMax * unitSize;
    const svgYBottom = originY - yMin * unitSize;

    const els: React.ReactNode[] = [];

    if (showGrid) {
      for (let xi = Math.ceil(xMin); xi <= Math.floor(xMax); xi++) {
        if (xi === 0) continue;
        const sx = originX + xi * unitSize;
        els.push(<line key={`gv-${xi}`} x1={sx} y1={svgYTop} x2={sx} y2={svgYBottom}
          stroke="rgba(120, 120, 128, 0.12)" strokeWidth={0.5} />);
      }
      for (let yi = Math.ceil(yMin); yi <= Math.floor(yMax); yi++) {
        if (yi === 0) continue;
        const sy = originY - yi * unitSize;
        els.push(<line key={`gh-${yi}`} x1={svgXMin} y1={sy} x2={svgXMax} y2={sy}
          stroke="rgba(120, 120, 128, 0.12)" strokeWidth={0.5} />);
      }
    }

    els.push(<line key="x-axis"
      x1={svgXMin} y1={originY} x2={svgXMax} y2={originY}
      stroke="rgba(60, 60, 67, 0.35)" strokeWidth={1.25} markerEnd="url(#coord-arrow)" />);
    els.push(<line key="y-axis"
      x1={originX} y1={svgYBottom} x2={originX} y2={svgYTop}
      stroke="rgba(60, 60, 67, 0.35)" strokeWidth={1.25} markerEnd="url(#coord-arrow)" />);

    if (showLabels) {
      for (let xi = Math.ceil(xMin); xi <= Math.floor(xMax); xi++) {
        if (xi === 0) continue;
        const sx = originX + xi * unitSize;
        els.push(<line key={`tx-${xi}`} x1={sx} y1={originY - 4} x2={sx} y2={originY + 4}
          stroke="rgba(60, 60, 67, 0.35)" strokeWidth={1} />);
        els.push(<text key={`lx-${xi}`} x={sx} y={originY + 16}
          textAnchor="middle" fontSize={10.5} fontWeight="500" fill="rgba(60, 60, 67, 0.45)" letterSpacing="-0.01em">{xi}</text>);
      }
      for (let yi = Math.ceil(yMin); yi <= Math.floor(yMax); yi++) {
        if (yi === 0) continue;
        const sy = originY - yi * unitSize;
        els.push(<line key={`ty-${yi}`} x1={originX - 4} y1={sy} x2={originX + 4} y2={sy}
          stroke="rgba(60, 60, 67, 0.35)" strokeWidth={1} />);
        els.push(<text key={`ly-${yi}`} x={originX - 8} y={sy + 4}
          textAnchor="end" fontSize={10.5} fontWeight="500" fill="rgba(60, 60, 67, 0.45)" letterSpacing="-0.01em">{yi}</text>);
      }
      els.push(<text key="origin" x={originX - 8} y={originY + 16}
        textAnchor="end" fontSize={10.5} fontWeight="500" fill="rgba(60, 60, 67, 0.45)" letterSpacing="-0.01em">O</text>);
      els.push(<text key="xl" x={svgXMax + 12} y={originY + 5}
        fontSize={13} fontStyle="italic" fontWeight="600" fill="rgba(60, 60, 67, 0.65)" letterSpacing="-0.02em">{xLabel}</text>);
      els.push(<text key="yl" x={originX + 6} y={svgYTop - 8}
        fontSize={13} fontStyle="italic" fontWeight="600" fill="rgba(60, 60, 67, 0.65)" letterSpacing="-0.02em">{yLabel}</text>);
    }

    return (
      <g className="coordinate-system" style={{ animation: 'coordFadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}>
        {els}
      </g>
    );
  }, [coordVisible, dsl]);

  /** 渲染数学点 */
  const renderMathPoint = useCallback((pt: MathPoint) => {
    if (!visibleMathIds.has(pt.id) || !dsl?.mathCanvas) return null;

    const pos = dataToSvg(pt.x, pt.y, dsl.mathCanvas);
    const r = pt.radius ?? 5;
    const color = pt.color ?? '#e74c3c';
    const isHighlighted = highlightedMathIds.has(pt.id);
    const hasAnim = mathAnimations.has(pt.id);

    const pointStyle: React.CSSProperties = hasAnim ? {
      transformOrigin: `${pos.x}px ${pos.y}px`,
      animation: `mathPointIn 0.4s ease-out forwards`,
    } : {};

    return (
      <g key={`mp-${pt.id}`} className="math-point">
        <circle cx={pos.x} cy={pos.y} r={r}
          fill={color}
          stroke={isHighlighted ? '#FFD700' : '#fff'}
          strokeWidth={isHighlighted ? 3 : 1.5}
          style={pointStyle}
        />
        {pt.label && (
          <text x={pos.x + r + 4} y={pos.y - r - 2}
            fontSize={12} fontWeight="600" fill="#333"
            style={hasAnim ? { opacity: 0, animation: 'nodeTextIn 0.3s ease-in 0.2s forwards' } : {}}
          >
            {pt.label}
          </text>
        )}
      </g>
    );
  }, [visibleMathIds, dsl, highlightedMathIds, mathAnimations]);

  /** 渲染数学线 */
  const renderMathLine = useCallback((line: MathLine) => {
    const lineId = line.id || `${line.from}->${line.to}`;
    if (!visibleMathIds.has(lineId) || !dsl?.mathCanvas) return null;

    const fromPt = mathPoints.get(line.from);
    const toPt = mathPoints.get(line.to);
    if (!fromPt || !toPt) return null;

    const mc = dsl.mathCanvas;
    let fromSvg = dataToSvg(fromPt.x, fromPt.y, mc);
    let toSvg = dataToSvg(toPt.x, toPt.y, mc);

    if (line.extend) {
      const extended = extendLineToRange(fromSvg, toSvg, mc);
      fromSvg = extended.from;
      toSvg = extended.to;
    }

    const color = line.color ?? '#3498db';
    const width = line.width ?? 2;
    const isHighlighted = highlightedMathIds.has(lineId);
    const hasAnim = mathAnimations.has(lineId);

    const pathLength = Math.ceil(Math.sqrt(
      Math.pow(toSvg.x - fromSvg.x, 2) + Math.pow(toSvg.y - fromSvg.y, 2)
    )) + 20;
    const drawDur = NODE_ANIMATION_DURATION * 0.7 / 1000;

    const lineStyle: React.CSSProperties = hasAnim ? {
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength,
      animation: `edgeStrokeDraw ${drawDur}s ease-out forwards`,
    } : {
      strokeDasharray: line.dashed ? '8,4' : undefined,
    };

    const midX = (fromSvg.x + toSvg.x) / 2;
    const midY = (fromSvg.y + toSvg.y) / 2;

    return (
      <g key={`ml-${lineId}`} className="math-line">
        <line
          x1={fromSvg.x} y1={fromSvg.y}
          x2={toSvg.x} y2={toSvg.y}
          stroke={isHighlighted ? '#FFD700' : color}
          strokeWidth={isHighlighted ? width + 1 : width}
          style={lineStyle}
        />
        {line.label && (
          <text x={midX} y={midY - 8}
            textAnchor="middle" fontSize={12} fontWeight="500"
            fill={color}
            style={hasAnim ? { opacity: 0, animation: 'edgeLabelIn 0.3s ease-in 0.3s forwards' } : {}}
          >
            {line.label}
          </text>
        )}
      </g>
    );
  }, [visibleMathIds, dsl, mathPoints, highlightedMathIds, mathAnimations]);

  /** 渲染数学曲线（预留扩展） */
  const renderMathCurve = useCallback((curve: MathCurve) => {
    if (!visibleMathIds.has(curve.id) || !dsl?.mathCanvas) return null;

    const mc = dsl.mathCanvas;
    
    // 防御性检查: 确保 curve.range 存在且是有效数组
    if (!curve.range || !Array.isArray(curve.range) || curve.range.length < 2) {
      console.warn(`MathCurve "${curve.id}" 缺少有效的 range 属性，跳过渲染`);
      return null;
    }
    
    const [rangeMin, rangeMax] = curve.range;
    const color = curve.color ?? '#9b59b6';
    const width = curve.width ?? 2;
    const hasAnim = mathAnimations.has(curve.id);

    // 采样点生成 SVG path
    const sampleCount = 200;
    const step = (rangeMax - rangeMin) / sampleCount;
    const points: string[] = [];

    try {
      // 安全执行函数表达式
      const fn = new Function('x', `return ${curve.fn}`);
      for (let i = 0; i <= sampleCount; i++) {
        const mathX = rangeMin + i * step;
        const mathY = fn(mathX);
        if (typeof mathY !== 'number' || !isFinite(mathY)) continue;
        const svgPos = dataToSvg(mathX, mathY, mc);
        points.push(`${i === 0 ? 'M' : 'L'} ${svgPos.x} ${svgPos.y}`);
      }
    } catch {
      return null;
    }

    if (points.length < 2) return null;
    const pathD = points.join(' ');

    const pathLength = 2000; // 估算值
    const drawDur = NODE_ANIMATION_DURATION / 1000;

    const curveStyle: React.CSSProperties = hasAnim ? {
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength,
      animation: `edgeStrokeDraw ${drawDur}s ease-out forwards`,
    } : {
      strokeDasharray: curve.dashed ? '8,4' : undefined,
    };

    return (
      <g key={`mc-${curve.id}`} className="math-curve">
        <path d={pathD} fill="none" stroke={color} strokeWidth={width} style={curveStyle} />
        {curve.label && (
          <text x={dataToSvg(rangeMax, 0, mc).x - 10} y={dataToSvg(0, 0, mc).y - 10}
            fontSize={12} fontWeight="500" fill={color}
          >
            {curve.label}
          </text>
        )}
      </g>
    );
  }, [visibleMathIds, dsl, mathAnimations]);

  const renderNode = useCallback((node: Node, pos: Position, isVisible: boolean) => {
    if (!node || !node.id || !pos) return null;

    const nodeType = node.type || 'concept';
    const style = NODE_STYLES[nodeType] || NODE_STYLES.concept;

    const isHighlighted = highlightedNodes.has(node.id);
    const animation = nodeAnimations.get(node.id);
    const customStyle = node.style || {};

    const label = node.label || '';
    const width = node.size?.width || calculateNodeWidth(label, style.fontSize);
    const height = node.size?.height || calculateNodeHeight(label, style.fontSize);
    const radius = node.size?.radius || DEFAULT_NODE_RADIUS;

    const fill = customStyle.fill || style.fill;
    const stroke = customStyle.border || (isHighlighted ? 'rgba(255, 122, 53, 0.8)' : style.stroke);
    const strokeWidth = isHighlighted ? 2.5 : style.strokeWidth;
    const baseOpacity = customStyle.opacity ?? 1;

    if (!isVisible) {
      return null;
    }

    const needsAnimation = !!animation;

    let shapePerimeter = 0;
    if (style.shape === 'circle') {
      shapePerimeter = Math.ceil(2 * Math.PI * radius) + 10;
    } else if (style.shape === 'diamond') {
      const sideLen = Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
      shapePerimeter = Math.ceil(4 * sideLen) + 10;
    } else {
      shapePerimeter = Math.ceil(2 * (width + height)) + 10;
    }

    const strokeDurS = NODE_ANIMATION_DURATION * 0.5 / 1000;
    const fillDelayS = NODE_ANIMATION_DURATION * 0.3 / 1000;
    const fillDurS = NODE_ANIMATION_DURATION * 0.4 / 1000;
    const textDelayS = NODE_ANIMATION_DURATION * 0.45 / 1000;
    const textDurS = NODE_ANIMATION_DURATION * 0.4 / 1000;

    const filterStyle = isHighlighted
      ? 'drop-shadow(0 4px 16px rgba(255, 122, 53, 0.45)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.08))'
      : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.06)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.04))';

    const shapeAnimStyle: React.CSSProperties = needsAnimation ? {
      strokeDasharray: shapePerimeter,
      strokeDashoffset: shapePerimeter,
      fillOpacity: 0,
      animation: `nodeStrokeDraw ${strokeDurS}s cubic-bezier(0.22, 1, 0.36, 1) forwards, nodeFillIn ${fillDurS}s cubic-bezier(0.22, 1, 0.36, 1) ${fillDelayS}s forwards`,
      filter: filterStyle,
    } : {
      filter: filterStyle,
    };

    const textAnimStyle: React.CSSProperties = needsAnimation ? {
      opacity: 0,
      animation: `nodeTextIn ${textDurS}s cubic-bezier(0.22, 1, 0.36, 1) ${textDelayS}s forwards`,
    } : {};

    const textColor = customStyle.color || (isHighlighted ? '#FF6B35' : 'rgba(29, 29, 31, 0.85)');

    return (
      <g
        key={node.id}
        className="node-group liquid-glass-node"
        opacity={baseOpacity}
      >
        {style.shape === 'circle' ? (
          <>
            <defs>
              <radialGradient id={`node-light-${node.id}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.5)" />
                <stop offset="50%" stopColor="rgba(255, 255, 255, 0.15)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
              </radialGradient>
              <linearGradient id={`node-fresnel-${node.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.7)" />
                <stop offset="25%" stopColor="rgba(255, 255, 255, 0.25)" />
                <stop offset="50%" stopColor="rgba(255, 255, 255, 0.08)" />
                <stop offset="75%" stopColor="rgba(255, 255, 255, 0.22)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.55)" />
              </linearGradient>
            </defs>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={radius + 4}
              fill={`url(#node-fresnel-${node.id})`}
              opacity={0.4}
            />
            <circle
              cx={pos.x}
              cy={pos.y}
              r={radius}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={shapeAnimStyle}
            />
            <circle
              cx={pos.x}
              cy={pos.y}
              r={radius - 2}
              fill={`url(#node-light-${node.id})`}
              pointerEvents="none"
              style={{ mixBlendMode: 'overlay' }}
            />
          </>
        ) : style.shape === 'diamond' ? (
          <>
            <polygon
              points={`${pos.x},${pos.y - height/2} ${pos.x + width/2},${pos.y} ${pos.x},${pos.y + height/2} ${pos.x - width/2},${pos.y}`}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={shapeAnimStyle}
              rx={8}
            />
          </>
        ) : (
          <>
            <defs>
              <linearGradient id={`rect-light-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
                <stop offset="35%" stopColor="rgba(255, 255, 255, 0.18)" />
                <stop offset="65%" stopColor="rgba(255, 255, 255, 0.05)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <linearGradient id={`rect-fresnel-${node.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.75)" />
                <stop offset="30%" stopColor="rgba(255, 255, 255, 0.28)" />
                <stop offset="60%" stopColor="rgba(255, 255, 255, 0.08)" />
                <stop offset="80%" stopColor="rgba(255, 255, 255, 0.32)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.62)" />
              </linearGradient>
            </defs>
            <rect
              x={pos.x - width / 2 - 1}
              y={pos.y - height / 2 - 1}
              width={width + 2}
              height={height + 2}
              rx={14}
              fill={`url(#rect-fresnel-${node.id})`}
              opacity={0.35}
            />
            <rect
              x={pos.x - width / 2}
              y={pos.y - height / 2}
              width={width}
              height={height}
              rx={12}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={shapeAnimStyle}
            />
            <rect
              x={pos.x - width / 2 + 1.5}
              y={pos.y - height / 2 + 1.5}
              width={width - 3}
              height={height - 3}
              rx={10.5}
              fill={`url(#rect-light-${node.id})`}
              pointerEvents="none"
              style={{ mixBlendMode: 'overlay' }}
            />
          </>
        )}

        <text
          x={pos.x}
          y={pos.y + style.fontSize / 3}
          textAnchor="middle"
          fontSize={style.fontSize}
          fontWeight={isHighlighted ? '600' : style.fontWeight}
          fill={textColor}
          letterSpacing="-0.01em"
          style={textAnimStyle}
        >
          {label}
        </text>
      </g>
    );
  }, [highlightedNodes, nodeAnimations]);

  const renderTimelineEvent = useCallback((event: TimelineEvent) => {
    if (!event || !event.from || !event.to) return null;

    const fromPos = positions.get(event.from);
    const toPos = positions.get(event.to);

    if (!fromPos || !toPos) return null;

    const anim = timelineAnimations.get(event.id);
    const progress = anim?.progress || 0;

    const currentX = fromPos.x + (toPos.x - fromPos.x) * progress;
    const currentY = fromPos.y + (toPos.y - fromPos.y) * progress;

    const labelX = fromPos.x + (toPos.x - fromPos.x) * 0.5;
    const labelY = fromPos.y + (toPos.y - fromPos.y) * 0.5 - 15;

    const isForward = event.direction !== 'backward';

    return (
      <g key={`timeline-${event.id}`} className="timeline-event">
        <line
          x1={fromPos.x}
          y1={fromPos.y}
          x2={toPos.x}
          y2={toPos.y}
          stroke={event.color || '#F48FB1'}
          strokeWidth={2}
          strokeDasharray="6,4"
          opacity={0.5}
        />
        <circle
          cx={currentX}
          cy={currentY}
          r={12}
          fill={event.color || '#F48FB1'}
          stroke="#EC407A"
          strokeWidth={2}
        />
        <text
          x={currentX}
          y={currentY + 4}
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
          fill="#ffffff"
        >
          {isForward ? '→' : '←'}
        </text>
        {event.label && (
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            fill={event.color || '#F48FB1'}
          >
            {event.label}
          </text>
        )}
      </g>
    );
  }, [positions, timelineAnimations]);

  const renderEdge = useCallback((edge: Edge, isVisible: boolean) => {
    if (!edge || !edge.from || !edge.to) return null;

    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);

    if (!fromPos || !toPos) return null;

    const edgeKey = `${edge.from}-${edge.to}`;
    const isHighlighted = highlightedEdges.has(edgeKey);
    const hasAnimation = edgeAnimations.has(edgeKey);
    const edgeStyle = edge.style || {};
    const stroke = edgeStyle.color || (isHighlighted ? '#FF8A65' : '#A1887F');
    const strokeWidth = edgeStyle.width || (isHighlighted ? 3 : 2);

    // 不可见且无动画则不渲染
    if (!isVisible && !hasAnimation) return null;

    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;

    let pathD = '';
    if (edge.type === 'curve') {
      const ctrlX = midX + (toPos.y - fromPos.y) * 0.2;
      const ctrlY = midY - (toPos.x - fromPos.x) * 0.2;
      pathD = `M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}`;
    } else {
      pathD = `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
    }

    const markerEnd = (edge.type === 'arrow' || edge.type === undefined) 
      ? (isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)') 
      : '';

    // 计算路径长度用于绘制动画
    const pathLength = Math.ceil(Math.sqrt(
      Math.pow(toPos.x - fromPos.x, 2) + Math.pow(toPos.y - fromPos.y, 2)
    )) + 20; // 额外余量确保完全绘制
    const edgeDurS = NODE_ANIMATION_DURATION * 0.7 / 1000;
    const labelDelayS = NODE_ANIMATION_DURATION * 0.5 / 1000;
    const labelDurS = NODE_ANIMATION_DURATION * 0.4 / 1000;

    // CSS 动画样式：边绘制
    const pathAnimStyle: React.CSSProperties = hasAnimation ? {
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength,
      animation: `edgeStrokeDraw ${edgeDurS}s ease-out forwards`,
      filter: isHighlighted ? 'drop-shadow(0 2px 6px rgba(255, 138, 101, 0.4))' : 'none',
    } : {
      strokeDasharray: edgeStyle.dashed ? '5,5' : undefined,
      filter: isHighlighted ? 'drop-shadow(0 2px 6px rgba(255, 138, 101, 0.4))' : 'none',
    };

    // 边标签动画样式
    const labelAnimStyle: React.CSSProperties = hasAnimation ? {
      opacity: 0,
      animation: `edgeLabelIn ${labelDurS}s ease-in ${labelDelayS}s forwards`,
    } : {
      opacity: isVisible ? 1 : 0,
    };

    return (
      <g key={edgeKey} className="edge-group">
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          markerEnd={markerEnd}
          opacity={hasAnimation ? 1 : (isVisible ? 1 : 0)}
          style={pathAnimStyle}
        />
        {edge.label && (
          <text
            x={midX}
            y={midY - 10}
            textAnchor="middle"
            fontSize={12}
            fill={stroke}
            fontWeight="500"
            style={labelAnimStyle}
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  }, [positions, highlightedEdges, edgeAnimations]);

  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = nodes ? Array.from(nodes.values()) : [];
  const safeVisibleNodeIds = visibleNodeIds instanceof Set ? visibleNodeIds : new Set<string>();
  const safeVisibleEdgeIds = visibleEdgeIds instanceof Set ? visibleEdgeIds : new Set<string>();

  const svgTransform = `translate(${viewport.offsetX}, ${viewport.offsetY}) scale(${viewport.scale})`;

  const hasSteps = dsl && dsl.steps && dsl.steps.length > 0;

  return (
    <div
      className="svg-container"
      ref={containerRef}
      style={{ touchAction: 'none' }}
    >
      {currentText && (
        <div className="step-text">
          {currentText}
        </div>
      )}

      <div className="canvas-controls-float">
        <button onClick={zoomOut} className="canvas-control-btn" title="缩小">
          −
        </button>
        <span className="zoom-level">{Math.round(viewport.scale * 100)}%</span>
        <button onClick={zoomIn} className="canvas-control-btn" title="放大">
          +
        </button>
        <button onClick={fitToView} className="canvas-control-btn" title="适应画布">
          ⛶
        </button>
        <button onClick={resetViewport} className="canvas-control-btn" title="重置">
          ⟲
        </button>
      </div>

      <svg
        width="100%"
        height="100%"
        style={{ flex: 1, background: 'transparent' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(120, 120, 128, 0.45)" />
          </marker>
          <marker id="arrowhead-highlighted" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255, 122, 53, 0.75)" />
          </marker>
          <marker id="coord-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(60, 60, 67, 0.35)" />
          </marker>
        </defs>

        <g transform={svgTransform}>
          {/* Layer 0: 坐标系 */}
          {renderCoordinateSystem()}
          {/* Layer 1: 数学对象（点/线/曲线） */}
          {Array.from(mathLines.values()).map(renderMathLine)}
          {Array.from(mathCurves.values()).map(renderMathCurve)}
          {Array.from(mathPoints.values()).map(renderMathPoint)}
          {/* Layer 2: 节点层（边 → 时间线 → 节点） */}
          {safeEdges.map(edge => renderEdge(edge, safeVisibleEdgeIds.has(`${edge.from}-${edge.to}`)))}
          {activeTimelineEvents.map(event => renderTimelineEvent(event))}
          {safeNodes.map(node => {
            const pos = positions.get(node.id);
            return pos ? renderNode(node, pos, safeVisibleNodeIds.has(node.id)) : null;
          })}
        </g>
      </svg>

      {hasSteps && (
        <div className="step-indicators">
          {dsl.steps.map((step, index) => (
            <div
              key={index}
              className={`step-dot ${index <= currentStep ? 'active' : ''}`}
              title={step.text}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const GraphCanvas = memo<GraphCanvasProps>(GraphCanvasComponent);
