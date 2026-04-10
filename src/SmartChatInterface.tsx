import React, { useState, useEffect } from 'react';
import { useSmartChat } from './useSmartChat';
import { Node, Edge } from './types';

interface SmartChatInterfaceProps {
  onNodesUpdate?: (nodes: Map<string, Node>) => void;
  onEdgesUpdate?: (edges: Edge[]) => void;
  onDrawingComplete?: () => void;
}

export const SmartChatInterface: React.FC<SmartChatInterfaceProps> = ({
  onNodesUpdate,
  onEdgesUpdate,
  onDrawingComplete
}) => {
  const [question, setQuestion] = useState('');
  const [currentExplanation, setCurrentExplanation] = useState('');
  
  const {
    isActive,
    isStreaming,
    currentStep,
    totalSteps,
    nodes,
    edges,
    drawingSteps,
    startDrawing,
    stopDrawing,
    resetDrawing
  } = useSmartChat(
    {
      enableStreaming: true,
      maxTokens: 500,
      temperature: 0.7
    },
    {
      onExplainText: (text) => {
        setCurrentExplanation(text);
      },
      onNodeAdded: (node) => {
        console.log('Node added:', node);
      },
      onEdgeAdded: (edge) => {
        console.log('Edge added:', edge);
      },
      onStepComplete: (step) => {
        console.log('Step complete:', step);
      },
      onComplete: () => {
        setCurrentExplanation('绘制完成！');
        onDrawingComplete?.();
      }
    }
  );

  useEffect(() => {
    if (nodes.size > 0) {
      onNodesUpdate?.(nodes);
    }
  }, [nodes, onNodesUpdate]);

  useEffect(() => {
    if (edges.length > 0) {
      onEdgesUpdate?.(edges);
    }
  }, [edges, onEdgesUpdate]);

  const handleStartDrawing = async () => {
    if (!question.trim()) {
      return;
    }

    setCurrentExplanation('正在开始绘制...');
    await startDrawing(question);
  };

  const handleStopDrawing = () => {
    stopDrawing();
    setCurrentExplanation('已停止绘制');
  };

  const handleResetDrawing = () => {
    resetDrawing();
    setQuestion('');
    setCurrentExplanation('');
  };

  return (
    <div className="smart-chat-interface">
      <div className="smart-chat-header">
        <h3>🖌️ 智能边讲边画</h3>
        {isActive && (
          <div className="status-badge">
            {isStreaming ? '🎨 绘制中...' : '⏸️ 已暂停'}
            <span className="step-counter">
              步骤 {currentStep}/{totalSteps}
            </span>
          </div>
        )}
      </div>

      <div className="smart-chat-input-section">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="输入你想要讲解的内容，例如：'讲解TCP三次握手'"
          disabled={isActive}
          rows={3}
          className="question-input"
        />
        
        <div className="action-buttons">
          {!isActive ? (
            <button
              onClick={handleStartDrawing}
              disabled={!question.trim()}
              className="start-button"
            >
              🚀 开始绘制
            </button>
          ) : (
            <>
              <button
                onClick={handleStopDrawing}
                className="stop-button"
              >
                ⏹️ 停止
              </button>
              <button
                onClick={handleResetDrawing}
                className="reset-button"
              >
                🔄 重置
              </button>
            </>
          )}
        </div>
      </div>

      {currentExplanation && (
        <div className="explanation-display">
          <div className="explanation-header">
            📝 当前讲解
          </div>
          <div className="explanation-text">
            {currentExplanation}
          </div>
        </div>
      )}

      {drawingSteps.length > 0 && (
        <div className="steps-history">
          <div className="history-header">
            📜 绘制历史
          </div>
          <div className="steps-list">
            {drawingSteps.map((step, index) => (
              <div key={index} className="step-item">
                <div className="step-number">{index + 1}</div>
                <div className="step-content">
                  <div className="step-explanation">
                    {step.explainText}
                  </div>
                  <div className="step-meta">
                    区域: {step.targetArea}
                    {step.node && ` | 节点: ${step.node.label}`}
                    {step.edge && ` | 连接: ${step.edge.from} → ${step.edge.to}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isActive && (
        <div className="progress-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartChatInterface;
