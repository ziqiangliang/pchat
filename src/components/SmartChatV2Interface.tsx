import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Node, Edge, Position, AnimationType } from '../types';
import { SmartChatEngineV2, StructureResult } from '../engines/SmartChatEngineV2';
import { elkLayoutEngine } from '../engines/elkLayoutEngine';
import { RoughRenderer } from '../engines/roughRenderer';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';

interface SmartChatV2InterfaceProps {
  onComplete?: () => void;
}

export const SmartChatV2Interface: React.FC<SmartChatV2InterfaceProps> = ({ onComplete }) => {
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [nodeAnimations, setNodeAnimations] = useState<Map<string, AnimationType>>(new Map());

  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<RoughRenderer | null>(null);
  const engineRef = useRef<SmartChatEngineV2 | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    rendererRef.current = new RoughRenderer({ seed: Date.now() });
    rendererRef.current.setSVG(svgRef.current);

    engineRef.current = new SmartChatEngineV2(
      { enableStreaming: true, maxTokens: 500, modelName: 'gpt-4o', temperature: 0.7, promptMaxTokens: 2000 },
      {
        onExplainText: (text) => {
          setExplanation(text);
        },
        onStructureReady: (structure: StructureResult) => {
          console.log('[SmartChatV2] onStructureReady called, structure:', structure);
          if (!structure || !structure.nodes || !structure.edges) {
            console.error('[SmartChatV2] Invalid structure received:', structure);
            return;
          }

          const v2Nodes = engineRef.current!.convertToNodes(structure);
          const v2Edges = engineRef.current!.convertToEdges(structure);
          console.log('[SmartChatV2] Converted nodes:', v2Nodes.length, 'edges:', v2Edges.length);

          setNodes(v2Nodes);
          setEdges(v2Edges);
          console.log('[SmartChatV2] State set, calling layout...');

          elkLayoutEngine.layout(v2Nodes, v2Edges).then(layoutPositions => {
            console.log('[SmartChatV2] Layout complete, positions:', layoutPositions.size);
            setPositions(layoutPositions);
            setVisibleNodeIds(new Set(v2Nodes.map(n => n.id)));
            animateNodeAppear(v2Nodes);
          }).catch(err => {
            console.error('[SmartChatV2] Layout error:', err);
          });
        },
        onLayoutReady: (pos) => {
          setPositions(pos);
        },
        onRenderComplete: () => {
          renderGraph();
        },
        onError: (error) => {
          console.error('[SmartChatV2] Error:', error);
          setIsLoading(false);
        },
        onComplete: () => {
          setIsLoading(false);
          setExplanation('绘制完成！');
          onComplete?.();
        }
      }
    );

    return () => {
      rendererRef.current?.clear();
    };
  }, [onComplete]);

  useEffect(() => {
    console.log('[SmartChatV2] useEffect triggered, nodes:', nodes.length, 'positions:', positions.size);
    renderGraph();
  }, [nodes, edges, positions, visibleNodeIds, highlightedNodes, nodeAnimations]);

  const animateNodeAppear = (allNodes: Node[]) => {
    const animations = new Map<string, AnimationType>();

    allNodes.forEach((node, index) => {
      setTimeout(() => {
        animations.set(node.id, 'fade');
        setNodeAnimations(new Map(animations));
      }, index * 200);
    });
  };

  const renderGraph = useCallback(() => {
    console.log('[SmartChatV2] renderGraph called, nodes:', nodes.length, 'positions:', positions.size, 'svgRef:', !!svgRef.current, 'renderer:', !!rendererRef.current);
    if (!rendererRef.current || !svgRef.current) {
      console.log('[SmartChatV2] renderGraph early return: no refs');
      return;
    }

    rendererRef.current.clear();

    nodes.forEach(node => {
      if (!visibleNodeIds.has(node.id)) return;

      const position = positions.get(node.id);
      if (!position) {
        console.log('[SmartChatV2] No position for node:', node.id);
        return;
      }

      const isHighlighted = highlightedNodes.has(node.id);
      const style = isHighlighted
        ? { strokeColor: '#FF8A65', fillColor: '#FFF3E0', strokeWidth: 3 }
        : {
            strokeColor: (node.style as any)?.border || '#5D4037',
            fillColor: (node.style as any)?.fill || '#FFFFFF',
            strokeWidth: 2
          };

      rendererRef.current?.renderNode(node, position, style);
    });

    edges.forEach(edge => {
      const fromPos = positions.get(edge.from);
      const toPos = positions.get(edge.to);

      if (!fromPos || !toPos) return;

      const isHighlighted =
        highlightedNodes.has(edge.from) || highlightedNodes.has(edge.to);

      const style = isHighlighted
        ? { strokeColor: '#FF8A65', strokeWidth: 3 }
        : {
            strokeColor: (edge.style as any)?.color || '#5D4037',
            strokeWidth: (edge.style as any)?.width || 2
          };

      rendererRef.current?.renderEdge(edge, fromPos, toPos, style);
    });
  }, [nodes, edges, positions, visibleNodeIds, highlightedNodes]);

  const handleStartDrawing = async () => {
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setExplanation('正在分析问题并生成结构...');
    setNodes([]);
    setEdges([]);
    setPositions(new Map());
    setVisibleNodeIds(new Set());

    await engineRef.current?.startDrawing(question);
  };

  const handleStopDrawing = () => {
    engineRef.current?.stop();
    setIsLoading(false);
    setExplanation('已停止绘制');
  };

  const handleReset = () => {
    engineRef.current?.stop();
    setQuestion('');
    setExplanation('');
    setNodes([]);
    setEdges([]);
    setPositions(new Map());
    setVisibleNodeIds(new Set());
    setHighlightedNodes(new Set());
    setNodeAnimations(new Map());
    setIsLoading(false);
    rendererRef.current?.clear();
  };

  return (
    <div className="smart-chat-v2-interface">
      <div className="chat-input-area">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="输入你的问题，AI将边讲边画..."
          rows={3}
          disabled={isLoading}
        />
        <div className="button-row">
          <button onClick={handleStartDrawing} disabled={isLoading || !question.trim()}>
            {isLoading ? '🎨 绘制中...' : '开始绘制'}
          </button>
          {isLoading && (
            <button onClick={handleStopDrawing} className="secondary">
              停止
            </button>
          )}
          <button onClick={handleReset} className="secondary">
            重置
          </button>
        </div>
      </div>

      {explanation && (
        <div className="explanation-area">
          <p>{explanation}</p>
        </div>
      )}

      <div className="canvas-area">
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

      <style>{`
        .smart-chat-v2-interface {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          height: 100%;
        }

        .chat-input-area {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chat-input-area textarea {
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          resize: none;
          font-family: inherit;
        }

        .chat-input-area textarea:focus {
          outline: none;
          border-color: #5D4037;
        }

        .button-row {
          display: flex;
          gap: 8px;
        }

        .button-row button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .button-row button:first-child {
          background: #5D4037;
          color: white;
        }

        .button-row button:first-child:hover:not(:disabled) {
          background: #6D4C41;
        }

        .button-row button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .button-row button.secondary {
          background: #e0e0e0;
          color: #333;
        }

        .explanation-area {
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.6;
        }

        .canvas-area {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }
      `}</style>
    </div>
  );
};

export default SmartChatV2Interface;
