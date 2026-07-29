import React, { useMemo, memo, useCallback } from 'react';
import { Node, Edge, Position, DSL, AnimationType, TimelineEvent, NODE_STYLES } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  NODE_ANIMATION_DURATION,
  ANNOTATION_OFFSET,
  DEFAULT_NODE_RADIUS
} from '../config';
import { calculateNodeWidth, calculateNodeHeight } from '../utils/nodeLabelMetrics';
import { layoutOptimizer } from '../engines/layoutOptimizer';
import { useCanvasGesture } from '../hooks/useCanvasGesture';

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
  onPrevStep?: () => void;
  onNextStep?: () => void;
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
  currentStep,
  onPrevStep,
  onNextStep
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
    resetViewport
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

    if (!Array.isArray(allNodes)) {
      return posMap;
    }

    if (allNodes.length === 0) {
      return posMap;
    }

    // 为缺失坐标的节点补默认位置（不可变副本，避免渲染阶段修改 store 对象）
    const processedNodes = allNodes.map((node, index) => {
      if (node.x !== undefined && node.y !== null && node.y !== undefined) {
        return node;
      }

      return {
        ...node,
        x: 100 + (index % 4) * 160,
        y: 80 + Math.floor(index / 4) * 120,
      };
    });

    const optimizedPositions = layoutOptimizer.optimize(processedNodes, edges);
    
    optimizedPositions.forEach((pos, id) => {
      posMap.set(id, pos);
    });

    allNodes
      .filter(node => node && node.type === 'annotation' && node.target)
      .forEach(annotation => {
        if (!annotation || !annotation.id) return;

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
  }, [nodesKey, edgesKey, nodes, edges]);

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

    let animationStyle = {};
    if (animation === 'fade') {
      animationStyle = { animation: `fadeIn ${NODE_ANIMATION_DURATION}ms ease` };
    } else if (animation === 'scale') {
      animationStyle = { animation: `scaleIn ${NODE_ANIMATION_DURATION}ms ease` };
    } else if (animation === 'move') {
      animationStyle = { animation: `slideIn ${NODE_ANIMATION_DURATION}ms ease` };
    }

    const fill = customStyle.fill || style.fill;
    const stroke = customStyle.border || (isHighlighted ? '#FF8A65' : style.stroke);
    const strokeWidth = isHighlighted ? 3.5 : style.strokeWidth;
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
              filter: isHighlighted ? 'drop-shadow(0 4px 12px rgba(255, 138, 101, 0.5))' : 'drop-shadow(0 2px 4px rgba(93, 64, 55, 0.1))',
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
              filter: isHighlighted ? 'drop-shadow(0 4px 12px rgba(255, 138, 101, 0.5))' : 'drop-shadow(0 2px 4px rgba(93, 64, 55, 0.1))',
              transition: 'opacity 0.3s ease, filter 0.3s ease'
            }}
          />
        ) : (
          <rect
            x={pos.x - width / 2}
            y={pos.y - height / 2}
            width={width}
            height={height}
            rx={12}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            style={{
              filter: isHighlighted ? 'drop-shadow(0 4px 12px rgba(255, 138, 101, 0.5))' : 'drop-shadow(0 2px 4px rgba(93, 64, 55, 0.1))',
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
          fill={customStyle.color || '#5D4037'}
          opacity={opacity}
          style={{ transition: 'opacity 0.3s ease' }}
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
    const edgeStyle = edge.style || {};
    const stroke = edgeStyle.color || (isHighlighted ? '#FF8A65' : '#A1887F');
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

    const markerEnd = (edge.type === 'arrow' || edge.type === undefined) 
      ? (isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)') 
      : '';

    return (
      <g key={edgeKey} className="edge-group">
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={edgeStyle.dashed ? '5,5' : 'none'}
          markerEnd={markerEnd}
          opacity={opacity}
          style={{
            filter: isHighlighted ? 'drop-shadow(0 2px 6px rgba(255, 138, 101, 0.4))' : 'none',
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
  }, [positions, highlightedEdges]);

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
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#A1887F" />
          </marker>
          <marker
            id="arrowhead-highlighted"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#FF8A65" />
          </marker>
        </defs>

        <g transform={svgTransform}>
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
          <button
            className="step-nav-btn step-nav-btn--prev"
            onClick={onPrevStep}
            disabled={currentStep <= 0}
            title="上一步"
          >
            ‹
          </button>
          <div className="step-dots">
            {dsl.steps.map((step, index) => (
              <div
                key={index}
                className={`step-dot ${index <= currentStep ? 'active' : ''}`}
                title={step.text}
              />
            ))}
          </div>
          <button
            className="step-nav-btn step-nav-btn--next"
            onClick={onNextStep}
            disabled={currentStep >= dsl.steps.length - 1}
            title="下一步"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};

export const GraphCanvas = memo(GraphCanvasComponent);
