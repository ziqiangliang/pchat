import React, { useMemo, memo } from 'react';
import { Node, Edge, Position, DSL, AnimationType, TimelineEvent, NODE_STYLES } from './types';
import {
  CANVAS_HEIGHT,
  NODE_ANIMATION_DURATION,
  ANNOTATION_OFFSET,
  DEFAULT_NODE_LABEL_PADDING,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_RADIUS
} from './config';

interface GraphCanvasProps {
  dsl: DSL | null;
  nodes: Map<string, Node>;
  edges: Edge[];
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  highlightedNodes: Set<string>;
  highlightedEdges: Set<string>;
  nodeAnimations: Map<string, AnimationType>;
  activeTimelineEvents: TimelineEvent[];
  timelineAnimations: Map<string, { progress: number }>;
  currentText: string;
  currentStep: number;
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
  activeTimelineEvents,
  timelineAnimations,
  currentText,
  currentStep
}) => {
  // 防御性计算：positions
  const positions = useMemo(() => {
    const allNodes = nodes ? Array.from(nodes.values()) : [];
    const posMap = new Map<string, Position>();

    // 防御性检查：确保 allNodes 是数组
    if (!Array.isArray(allNodes)) {
      return posMap;
    }

    allNodes.forEach(node => {
      // 防御性检查：节点必须有 id
      if (!node || !node.id) return;

      // 优先使用 x, y 坐标
      if (node.x !== undefined && node.y !== undefined) {
        posMap.set(node.id, { x: node.x, y: node.y });
      } else if (node.pos) {
        posMap.set(node.id, { x: node.pos.x, y: node.pos.y });
      }
    });

    // 处理标注节点
    allNodes
      .filter(node => node && node.type === 'annotation' && node.target)
      .forEach(annotation => {
        // 防御性检查
        if (!annotation || !annotation.id) return;

        // 如果已经有坐标，跳过
        if (annotation.x !== undefined && annotation.y !== undefined) {
          return;
        }

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
  }, [nodes]);

  const renderNode = (node: Node, pos: Position, isVisible: boolean) => {
    // 防御性检查
    if (!node || !node.id || !pos) return null;

    const nodeType = node.type || 'concept';

    // 防御性检查：获取节点样式
    const style = NODE_STYLES[nodeType] || NODE_STYLES.concept;

    const isHighlighted = highlightedNodes.has(node.id);
    const animation = nodeAnimations.get(node.id);
    const customStyle = node.style || {};

    // 防御性计算尺寸
    const label = node.label || '';
    const width = node.size?.width || (label.length * style.fontSize + DEFAULT_NODE_LABEL_PADDING);
    const height = node.size?.height || DEFAULT_NODE_HEIGHT;
    const radius = node.size?.radius || DEFAULT_NODE_RADIUS;

    // 动画样式
    let animationStyle = {};
    if (animation === 'fade') {
      animationStyle = { animation: `fadeIn ${NODE_ANIMATION_DURATION}ms ease` };
    } else if (animation === 'scale') {
      animationStyle = { animation: `scaleIn ${NODE_ANIMATION_DURATION}ms ease` };
    } else if (animation === 'move') {
      animationStyle = { animation: `slideIn ${NODE_ANIMATION_DURATION}ms ease` };
    }

    const fill = customStyle.fill || style.fill;
    const stroke = customStyle.border || (isHighlighted ? '#3b82f6' : style.stroke);
    const strokeWidth = isHighlighted ? 3 : style.strokeWidth;
    const baseOpacity = customStyle.opacity ?? 1;
    const opacity = isVisible ? baseOpacity : 0;

    return (
      <g
        key={node.id}
        style={animationStyle}
        className="node-group"
      >
        {style.shape === 'circle' ? (
          <circle
            cx={pos.x}
            cy={pos.y}
            r={radius}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            style={{
              filter: isHighlighted ? 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.4))' : 'none',
              transition: 'opacity 0.3s ease, filter 0.3s ease'
            }}
          />
        ) : style.shape === 'diamond' ? (
          <polygon
            points={`${pos.x},${pos.y - height/2} ${pos.x + width/2},${pos.y} ${pos.x},${pos.y + height/2} ${pos.x - width/2},${pos.y}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            style={{
              filter: isHighlighted ? 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.4))' : 'none',
              transition: 'opacity 0.3s ease, filter 0.3s ease'
            }}
          />
        ) : (
          <rect
            x={pos.x - width / 2}
            y={pos.y - height / 2}
            width={width}
            height={height}
            rx={8}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            style={{
              filter: isHighlighted ? 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.4))' : 'none',
              transition: 'opacity 0.3s ease, filter 0.3s ease'
            }}
          />
        )}

        <text
          x={pos.x}
          y={pos.y + style.fontSize / 3}
          textAnchor="middle"
          fontSize={style.fontSize}
          fontWeight={isHighlighted ? 'bold' : style.fontWeight}
          fill={customStyle.color || '#1e293b'}
          opacity={opacity}
          style={{ transition: 'opacity 0.3s ease' }}
        >
          {label}
        </text>
      </g>
    );
  };

  const renderTimelineEvent = (event: TimelineEvent) => {
    // 防御性检查
    if (!event || !event.from || !event.to) return null;

    const fromPos = positions.get(event.from);
    const toPos = positions.get(event.to);

    // 防御性检查：确保位置存在
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
          stroke={event.color || '#ec4899'}
          strokeWidth={2}
          strokeDasharray="4,4"
          opacity={0.5}
        />
        <circle
          cx={currentX}
          cy={currentY}
          r={12}
          fill={event.color || '#ec4899'}
          stroke="#be185d"
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
            fill={event.color || '#ec4899'}
          >
            {event.label}
          </text>
        )}
      </g>
    );
  };

  const renderEdge = (edge: Edge, isVisible: boolean) => {
    // 防御性检查
    if (!edge || !edge.from || !edge.to) return null;

    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);

    // 防御性检查：确保位置存在
    if (!fromPos || !toPos) return null;

    const edgeKey = `${edge.from}-${edge.to}`;
    const isHighlighted = highlightedEdges.has(edgeKey);
    const edgeStyle = edge.style || {};
    const stroke = edgeStyle.color || (isHighlighted ? '#3b82f6' : '#94a3b8');
    const strokeWidth = edgeStyle.width || (isHighlighted ? 3 : 2);
    const opacity = isVisible ? 1 : 0;

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

    return (
      <g key={edgeKey} className="edge-group">
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={edgeStyle.dashed ? '5,5' : 'none'}
          markerEnd={edge.type === 'arrow' || edge.type === undefined ? 'url(#arrowhead)' : ''}
          opacity={opacity}
          style={{
            filter: isHighlighted ? 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease'
          }}
        />
        {edge.label && (
          <text
            x={midX}
            y={midY - 10}
            textAnchor="middle"
            fontSize={12}
            fill={stroke}
            fontWeight="500"
            opacity={opacity}
            style={{ transition: 'opacity 0.3s ease' }}
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  };

  // 防御性检查：确保 edges 是数组
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = nodes ? Array.from(nodes.values()) : [];
  const safeVisibleNodeIds = visibleNodeIds instanceof Set ? visibleNodeIds : new Set<string>();
  const safeVisibleEdgeIds = visibleEdgeIds instanceof Set ? visibleEdgeIds : new Set<string>();

  return (
    <div className="svg-container">
      {currentText && (
        <div className="step-text">
          {currentText}
        </div>
      )}
      <svg
        width="100%"
        height={CANVAS_HEIGHT}
        style={{ background: '#ffffff' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>

        {safeEdges.map(edge => renderEdge(edge, safeVisibleEdgeIds.has(`${edge.from}-${edge.to}`)))}
        {activeTimelineEvents.map(event => renderTimelineEvent(event))}
        {safeNodes.map(node => {
          const pos = positions.get(node.id);
          return pos ? renderNode(node, pos, safeVisibleNodeIds.has(node.id)) : null;
        })}
      </svg>

      {dsl && dsl.steps && (
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

export const GraphCanvas = memo(GraphCanvasComponent);