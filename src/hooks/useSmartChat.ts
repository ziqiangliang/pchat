import { useEffect, useRef, useCallback } from 'react';
import { SmartChatEngine, createSmartChatEngine, SmartChatCallbacks } from '../engines/SmartChatEngine';
import { useSmartChatStore } from '../stores/smartChatStore';
import { Node, Edge, SmartChatConfig } from '../types';

export interface UseSmartChatReturn {
  isActive: boolean;
  isStreaming: boolean;
  currentStep: number;
  totalSteps: number;
  nodes: Map<string, Node>;
  edges: Edge[];
  drawingSteps: import('../types').DrawingStep[];
  startDrawing: (question: string) => Promise<void>;
  stopDrawing: () => void;
  resetDrawing: () => void;
  updateConfig: (config: Partial<SmartChatConfig>) => void;
  getEngine: () => SmartChatEngine | null;
}

export function useSmartChat(
  config?: Partial<SmartChatConfig>,
  callbacks?: Partial<SmartChatCallbacks>
): UseSmartChatReturn {
  const engineRef = useRef<SmartChatEngine | null>(null);

  const store = useSmartChatStore();
  const {
    isActive,
    isStreaming,
    currentDrawingStep,
    drawingSteps,
    sessionNodes,
    sessionEdges
  } = store;

  useEffect(() => {
    const smartChatEngine = createSmartChatEngine(config, callbacks);
    engineRef.current = smartChatEngine;

    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, []);

  const startDrawing = useCallback(async (question: string) => {
    if (engineRef.current) {
      await engineRef.current.startDrawing(question);
    }
  }, []);

  const stopDrawing = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
  }, []);

  const resetDrawing = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
    store.reset();
  }, [store]);

  const updateConfig = useCallback((newConfig: Partial<SmartChatConfig>) => {
    if (engineRef.current) {
      engineRef.current.updateConfig(newConfig);
    }
    store.updateConfig(newConfig);
  }, [store]);

  const getEngine = useCallback(() => {
    return engineRef.current;
  }, []);

  return {
    isActive,
    isStreaming,
    currentStep: currentDrawingStep,
    totalSteps: drawingSteps.length,
    nodes: sessionNodes,
    edges: sessionEdges,
    drawingSteps,
    startDrawing,
    stopDrawing,
    resetDrawing,
    updateConfig,
    getEngine
  };
}
