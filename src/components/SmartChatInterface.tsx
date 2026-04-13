import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSmartChat } from '../hooks/useSmartChat';
import { Node, Edge } from '../types';

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
  const { t } = useTranslation();
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
        setCurrentExplanation(t('smartChat.complete'));
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

    setCurrentExplanation(t('smartChat.starting'));
    await startDrawing(question);
  };

  const handleStopDrawing = () => {
    stopDrawing();
    setCurrentExplanation(t('smartChat.stopped'));
  };

  const handleResetDrawing = () => {
    resetDrawing();
    setQuestion('');
    setCurrentExplanation('');
  };

  return (
    <div className="smart-chat-interface">
      <div className="smart-chat-header">
        <h3>{t('smartChat.title')}</h3>
        {isActive && (
          <div className="status-badge">
            {isStreaming ? t('smartChat.drawing') : t('smartChat.paused')}
            <span className="step_counter">
              {t('smartChat.stepInfo', { current: currentStep, total: totalSteps })}
            </span>
          </div>
        )}
      </div>

      <div className="smart-chat-input-section">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('smartChat.placeholder')}
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
              {t('smartChat.start')}
            </button>
          ) : (
            <>
              <button
                onClick={handleStopDrawing}
                className="stop-button"
              >
                {t('smartChat.stop')}
              </button>
              <button
                onClick={handleResetDrawing}
                className="reset-button"
              >
                {t('smartChat.reset')}
              </button>
            </>
          )}
        </div>
      </div>

      {currentExplanation && (
        <div className="explanation-display">
          <div className="explanation-header">
            {t('smartChat.currentExplanation')}
          </div>
          <div className="explanation-text">
            {currentExplanation}
          </div>
        </div>
      )}

      {drawingSteps.length > 0 && (
        <div className="steps-history">
          <div className="history-header">
            {t('smartChat.history')}
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
                    {t('smartChat.area')}: {step.targetArea}
                    {step.node && ` | ${t('smartChat.node')}: ${step.node.label}`}
                    {step.edge && ` | ${t('smartChat.connection')}: ${step.edge.from} → ${step.edge.to}`}
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
