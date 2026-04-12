import React, { useRef, useEffect } from 'react';
import { Node, Edge, Position, AnimationType } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { elkLayoutEngine } from '../engines/elkLayoutEngine';
import { RoughRenderer, RoughStyle } from '../engines/roughRenderer';

interface RoughCanvasProps {
  nodes: Node[];
  edges: Edge[];
  visibleNodeIds: Set<string>;
  highlightedNodes: Set<string>;
  nodeAnimations: Map<string, AnimationType>;
  currentStep: number;
  onLayoutComplete?: (positions: Map<string, Position>) => void;
}

const DEFAULT_ROUGH_STYLE: RoughStyle = {
  strokeColor: '#5D4037',
  fillColor: '#FFFFFF',
  fillStyle: 'hachure',
  strokeWidth: 2,
  roughness: 1.2,
  bowing: 0.5
};

const HIGHLIGHT_STYLE: RoughStyle = {
  strokeColor: '#FF8A65',
  fillColor: '#FFF3E0',
  strokeWidth: 3
};

export const RoughCanvas: React.FC<RoughCanvasProps> = ({
  nodes,
  edges,
  visibleNodeIds,
  highlightedNodes,
  nodeAnimations,
  currentStep,
  onLayoutComplete
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<RoughRenderer | null>(null);
  const positionsRef = useRef<Map<string, Position>>(new Map());

  useEffect(() => {
    if (!svgRef.current) return;

    rendererRef.current = new RoughRenderer({ seed: Date.now() });
    rendererRef.current.setSVG(svgRef.current);

    return () => {
      rendererRef.current?.clear();
    };
  }, []);

  useEffect(() => {
    const layoutNodes = async () => {
      if (nodes.length === 0) return;

      const positions = await elkLayoutEngine.layout(nodes, edges);
      positionsRef.current = positions;
      onLayoutComplete?.(positions);
    };

    layoutNodes();
  }, [nodes, edges, onLayoutComplete]);

  useEffect(() => {
    if (!rendererRef.current) return;

    rendererRef.current.clear();

    nodes.forEach(node => {
      if (!visibleNodeIds.has(node.id)) return;

      const position = positionsRef.current.get(node.id);
      if (!position) return;

      const isHighlighted = highlightedNodes.has(node.id);
      const style = isHighlighted
        ? { ...DEFAULT_ROUGH_STYLE, ...HIGHLIGHT_STYLE }
        : { ...DEFAULT_ROUGH_STYLE, ...node.style };

      const animation = nodeAnimations.get(node.id);

      if (animation) {
        rendererRef.current?.renderNode(node, position, style);
      } else {
        rendererRef.current?.renderNode(node, position, style);
      }
    });

    edges.forEach(edge => {
      const fromPos = positionsRef.current.get(edge.from);
      const toPos = positionsRef.current.get(edge.to);

      if (!fromPos || !toPos) return;

      const isHighlighted =
        highlightedNodes.has(edge.from) || highlightedNodes.has(edge.to);

      const style = isHighlighted
        ? { ...DEFAULT_ROUGH_STYLE, ...HIGHLIGHT_STYLE }
        : { ...DEFAULT_ROUGH_STYLE, ...edge.style };

      rendererRef.current?.renderEdge(edge, fromPos, toPos, style);
    });
  }, [nodes, edges, visibleNodeIds, highlightedNodes, nodeAnimations, currentStep]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <svg
        ref={svgRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          background: '#fafafa'
        }}
      />
    </div>
  );
};

export default RoughCanvas;
