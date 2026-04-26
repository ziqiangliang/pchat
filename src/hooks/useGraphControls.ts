import { useCallback, useRef, useEffect } from 'react';
import { useStore } from '../stores/store';
import { Step } from '../types';
import { NODE_ANIMATION_DURATION, TIMELINE_DURATION, TIMELINE_EVENT_DELAY, TYPING_BASE_DELAY, TYPING_PER_CHAR_DELAY, STEP_BASE_INTERVAL } from '../config';
import { StepPlayer } from '../engines/stepPlayer';

interface GraphControlsReturn {
  executeStep: (step: Step, stepIndex: number) => number;
  handleClear: () => void;
  handleJumpToStep: (stepIndex: number) => void;
  handlePrevStep: () => void;
  handleNextStep: () => void;
  stepPlayer: StepPlayer;
}

export const useGraphControls = (): GraphControlsReturn => {
  const {
    setDsl,
    setNodes,
    setEdges,
    setVisibleNodeIds,
    setVisibleEdgeIds,
    setHighlightedNodes,
    setHighlightedEdges,
    setNodeAnimations,
    setEdgeAnimations,
    setActiveTimelineEvents,
    setTimelineAnimations,
    setDisplayText,
    setCoordVisible,
    setMathPoints,
    setMathLines,
    setMathCurves,
    setVisibleMathIds,
    setMathAnimations,
    setHighlightedMathIds,
    resetGraphState
  } = useStore();

  const stepPlayerRef = useRef<StepPlayer | null>(null);
  const typingTimeoutIdsRef = useRef<Set<number>>(new Set());

  const getCurrentState = useCallback(() => {
    const state = useStore.getState();
    return {
      nodes: state.nodes,
      edges: state.edges,
      visibleNodeIds: state.visibleNodeIds,
      visibleEdgeIds: state.visibleEdgeIds,
      nodeAnimations: state.nodeAnimations,
      edgeAnimations: state.edgeAnimations,
      activeTimelineEvents: state.activeTimelineEvents,
      timelineAnimations: state.timelineAnimations,
      highlightedNodes: state.highlightedNodes,
      highlightedEdges: state.highlightedEdges,
      // 数学层
      mathPoints: state.mathPoints,
      mathLines: state.mathLines,
      mathCurves: state.mathCurves,
      visibleMathIds: state.visibleMathIds,
      mathAnimations: state.mathAnimations,
      highlightedMathIds: state.highlightedMathIds,
      coordVisible: state.coordVisible
    };
  }, []);

  const clearAllTypingTimeouts = useCallback(() => {
    typingTimeoutIdsRef.current.forEach(id => clearTimeout(id));
    typingTimeoutIdsRef.current.clear();
  }, []);

  const startTypingEffect = useCallback((fullText: string, onComplete?: () => void) => {
    clearAllTypingTimeouts();

    let charIndex = 0;
    const typeNextChar = () => {
      if (useStore.getState().isPaused) {
        const timeoutId = window.setTimeout(typeNextChar, 100);
        typingTimeoutIdsRef.current.add(timeoutId);
        return;
      }

      charIndex++;
      setDisplayText(fullText.substring(0, charIndex));

      if (charIndex < fullText.length) {
        const timeoutId = window.setTimeout(typeNextChar, TYPING_PER_CHAR_DELAY);
        typingTimeoutIdsRef.current.add(timeoutId);
      } else {
        onComplete?.();
      }
    };

    const timeoutId = window.setTimeout(typeNextChar, TYPING_BASE_DELAY);
    typingTimeoutIdsRef.current.add(timeoutId);
  }, [setDisplayText, clearAllTypingTimeouts]);

  const executeStep = useCallback((step: Step, stepIndex: number) => {
    try {
      const current = getCurrentState();
      let newNodes = new Map(current.nodes);
      let newEdges = [...current.edges];
      let newVisibleNodeIds = new Set(current.visibleNodeIds);
      let newVisibleEdgeIds = new Set(current.visibleEdgeIds);
      let newNodeAnimations = new Map(current.nodeAnimations);
      let newEdgeAnimations = new Map(current.edgeAnimations);
      let newActiveTimelineEvents = [...current.activeTimelineEvents];
      let newTimelineAnimations = new Map(current.timelineAnimations);

      const animType = step.animate?.type || 'fade';
      const animDuration = step.animate?.duration || NODE_ANIMATION_DURATION;

      // ===== 1. 先处理 remove（删除节点 + 关联边） =====
      if (step.remove && Array.isArray(step.remove)) {
        const removedNodeIds = new Set(step.remove);

        // 从可见集合中移除节点
        step.remove.forEach(id => {
          if (id) {
            newVisibleNodeIds.delete(id);
            newNodes.delete(id);
          }
        });

        // 彻底删除关联边（从 edges 数组 + visibleEdgeIds 中移除）
        newEdges = newEdges.filter(edge => {
          if (removedNodeIds.has(edge.from) || removedNodeIds.has(edge.to)) {
            newVisibleEdgeIds.delete(`${edge.from}-${edge.to}`);
            newEdgeAnimations.delete(`${edge.from}-${edge.to}`);
            return false; // 从数组中删除
          }
          return true;
        });
      }

      // ===== 2. 添加节点（总是带动画） =====
      if (step.add && Array.isArray(step.add)) {
        step.add.forEach(node => {
          if (node && node.id) {
            newNodes.set(node.id, node);
            newVisibleNodeIds.add(node.id);
            newNodeAnimations.set(node.id, animType);
          }
        });

        // 动画结束后清除动画状态
        step.add.forEach(node => {
          if (node && node.id) {
            setTimeout(() => {
              const currentAnims = useStore.getState().nodeAnimations;
              const newMap = new Map(currentAnims);
              newMap.delete(node.id!);
              setNodeAnimations(newMap);
            }, animDuration);
          }
        });
      }

      // ===== 3. 添加边（延迟出现，带绘制动画） =====
      if (step.connect && Array.isArray(step.connect)) {
        const edgeDelay = step.add && step.add.length > 0 ? animDuration * 0.4 : 0;

        step.connect.forEach(edge => {
          if (edge && edge.from && edge.to) {
            // 如果已存在相同 from→to 的边，用新边替换（更新标签等）
            const existingIdx = newEdges.findIndex(e => e.from === edge.from && e.to === edge.to);
            if (existingIdx >= 0) {
              newEdges[existingIdx] = edge;
            } else {
              newEdges.push(edge);
            }
            const edgeKey = `${edge.from}-${edge.to}`;

            if (edgeDelay > 0) {
              // 延迟添加边的可见性和动画
              setTimeout(() => {
                const state = useStore.getState();

                // 安全检查：如果端点节点已不可见（被后续步骤 remove），不再添加边
                if (!state.visibleNodeIds.has(edge.from) || !state.visibleNodeIds.has(edge.to)) {
                  return;
                }

                const updatedVisibleEdgeIds = new Set(state.visibleEdgeIds);
                updatedVisibleEdgeIds.add(edgeKey);
                setVisibleEdgeIds(updatedVisibleEdgeIds);

                const updatedEdgeAnims = new Map(state.edgeAnimations);
                updatedEdgeAnims.set(edgeKey, 'draw');
                setEdgeAnimations(updatedEdgeAnims);

                // 动画结束后清除
                setTimeout(() => {
                  const anims = useStore.getState().edgeAnimations;
                  const m = new Map(anims);
                  m.delete(edgeKey);
                  setEdgeAnimations(m);
                }, animDuration);
              }, edgeDelay);
            } else {
              newVisibleEdgeIds.add(edgeKey);
              newEdgeAnimations.set(edgeKey, 'draw');
            }
          }
        });

        // 无延迟时，清除动画
        if (edgeDelay === 0) {
          step.connect.forEach(edge => {
            if (edge && edge.from && edge.to) {
              const edgeKey = `${edge.from}-${edge.to}`;
              setTimeout(() => {
                const anims = useStore.getState().edgeAnimations;
                const m = new Map(anims);
                m.delete(edgeKey);
                setEdgeAnimations(m);
              }, animDuration);
            }
          });
        }
      }

      // ===== 4. 高亮 =====
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());

      if (step.highlight && Array.isArray(step.highlight)) {
        setHighlightedNodes(new Set(step.highlight));

        const highlightedEdgeSet = new Set<string>();
        newEdges.forEach(edge => {
          if (step.highlight!.includes(edge.from) || step.highlight!.includes(edge.to)) {
            highlightedEdgeSet.add(`${edge.from}-${edge.to}`);
          }
        });
        setHighlightedEdges(highlightedEdgeSet);
      }

      // ===== 5. 提交状态 =====
      setNodes(newNodes);
      setEdges(newEdges);
      setVisibleNodeIds(newVisibleNodeIds);
      setVisibleEdgeIds(newVisibleEdgeIds);
      setNodeAnimations(newNodeAnimations);
      setEdgeAnimations(newEdgeAnimations);
      setActiveTimelineEvents(newActiveTimelineEvents);
      setTimelineAnimations(newTimelineAnimations);

      // ===== 6. 数学层操作（showCoord + math） =====
      if (step.showCoord) {
        setCoordVisible(true);
      }

      if (step.math) {
        const mathState = getCurrentState();
        let newMathPoints = new Map(mathState.mathPoints);
        let newMathLines = new Map(mathState.mathLines);
        let newMathCurves = new Map(mathState.mathCurves);
        let newVisibleMathIds = new Set(mathState.visibleMathIds);
        let newMathAnims = new Map(mathState.mathAnimations);

        // 移除数学对象
        if (step.math.removePoints) {
          step.math.removePoints.forEach(id => {
            newMathPoints.delete(id);
            newVisibleMathIds.delete(id);
            newMathAnims.delete(id);
          });
        }
        if (step.math.removeLines) {
          step.math.removeLines.forEach(id => {
            newMathLines.delete(id);
            newVisibleMathIds.delete(id);
            newMathAnims.delete(id);
          });
        }
        if (step.math.removeCurves) {
          step.math.removeCurves.forEach(id => {
            newMathCurves.delete(id);
            newVisibleMathIds.delete(id);
            newMathAnims.delete(id);
          });
        }

        // 添加数学点
        if (step.math.addPoints) {
          step.math.addPoints.forEach(pt => {
            newMathPoints.set(pt.id, pt);
            newVisibleMathIds.add(pt.id);
            newMathAnims.set(pt.id, 'scale');
          });
        }

        // 添加数学线
        if (step.math.addLines) {
          step.math.addLines.forEach(line => {
            const lineId = line.id || `${line.from}->${line.to}`;
            newMathLines.set(lineId, { ...line, id: lineId });
            newVisibleMathIds.add(lineId);
            newMathAnims.set(lineId, 'draw');
          });
        }

        // 添加数学曲线
        if (step.math.addCurves) {
          step.math.addCurves.forEach(curve => {
            newMathCurves.set(curve.id, curve);
            newVisibleMathIds.add(curve.id);
            newMathAnims.set(curve.id, 'draw');
          });
        }

        // 高亮数学对象
        if (step.math.highlight) {
          setHighlightedMathIds(new Set(step.math.highlight));
        } else {
          setHighlightedMathIds(new Set());
        }

        // 提交数学层状态
        setMathPoints(newMathPoints);
        setMathLines(newMathLines);
        setMathCurves(newMathCurves);
        setVisibleMathIds(newVisibleMathIds);
        setMathAnimations(newMathAnims);

        // 动画结束后清除动画状态
        setTimeout(() => {
          const curAnims = useStore.getState().mathAnimations;
          const cleaned = new Map(curAnims);
          // 只清除这一步添加的动画
          if (step.math?.addPoints) step.math.addPoints.forEach(pt => cleaned.delete(pt.id));
          if (step.math?.addLines) step.math.addLines.forEach(l => cleaned.delete(l.id || `${l.from}->${l.to}`));
          if (step.math?.addCurves) step.math.addCurves.forEach(c => cleaned.delete(c.id));
          setMathAnimations(cleaned);
        }, animDuration);
      }

      // ===== 7. Timeline 事件 =====

      if (step.timeline && Array.isArray(step.timeline)) {
        step.timeline.forEach((event, index) => {
          if (!event || !event.id) return;

          const delay = (event.delay || 0) + index * TIMELINE_EVENT_DELAY;

          setTimeout(() => {
            const currentStepNow = useStore.getState().currentStep;
            if (currentStepNow !== stepIndex) return;

            const prevEvents = useStore.getState().activeTimelineEvents;
            if (!prevEvents.some(e => e.id === event.id)) {
              setActiveTimelineEvents([...prevEvents, event]);
            }

            const prevTimeAnims = useStore.getState().timelineAnimations;
            const newMap = new Map(prevTimeAnims);
            newMap.set(event.id, { progress: 0 });
            setTimelineAnimations(newMap);

            const startTime = Date.now();

            const animate = () => {
              if (useStore.getState().isPaused) {
                requestAnimationFrame(animate);
                return;
              }

              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / TIMELINE_DURATION, 1);

              const currAnims = useStore.getState().timelineAnimations;
              const animMap = new Map(currAnims);
              animMap.set(event.id, { progress });
              setTimelineAnimations(animMap);

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setTimeout(() => {
                  const finalAnims = useStore.getState().timelineAnimations;
                  const finalMap = new Map(finalAnims);
                  finalMap.delete(event.id!);
                  setTimelineAnimations(finalMap);

                  const finalEvents = useStore.getState().activeTimelineEvents;
                  setActiveTimelineEvents(finalEvents.filter(e => e.id !== event.id));
                }, STEP_BASE_INTERVAL);
              }
            };

            requestAnimationFrame(animate);
          }, delay);
        });
      }

      return 0;
    } catch (error) {
      console.error('Error executing step:', error);
      return 0;
    }
  }, [getCurrentState, setNodes, setEdges, setVisibleNodeIds, setVisibleEdgeIds, setNodeAnimations, setEdgeAnimations, setActiveTimelineEvents, setTimelineAnimations, setHighlightedNodes, setHighlightedEdges, setCoordVisible, setMathPoints, setMathLines, setMathCurves, setVisibleMathIds, setMathAnimations, setHighlightedMathIds]);

  useEffect(() => {
    if (!stepPlayerRef.current) {
      stepPlayerRef.current = new StepPlayer({
        executeStep,
        startTyping: startTypingEffect
      });
    }
  }, [executeStep, startTypingEffect]);

  const handleClear = useCallback(() => {
    clearAllTypingTimeouts();
    stepPlayerRef.current?.stop();
    resetGraphState();
    setDsl(null);
  }, [resetGraphState, setDsl, clearAllTypingTimeouts]);

  const handleJumpToStep = useCallback((stepIndex: number) => {
    stepPlayerRef.current?.jumpToStep(stepIndex);
  }, []);

  const handlePrevStep = useCallback(() => {
    stepPlayerRef.current?.prevStep();
  }, []);

  const handleNextStep = useCallback(() => {
    stepPlayerRef.current?.nextStep();
  }, []);

  return {
    executeStep,
    handleClear,
    handleJumpToStep,
    handlePrevStep,
    handleNextStep,
    stepPlayer: stepPlayerRef.current!
  };
};
