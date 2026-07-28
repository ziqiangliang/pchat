import { useCallback, useRef, useEffect } from 'react';
import { useStore } from '../stores/store';
import { Step } from '../types';
import { NODE_ANIMATION_DURATION, TIMELINE_DURATION, TIMELINE_EVENT_DELAY, TYPING_BASE_DELAY, TYPING_PER_CHAR_DELAY, STEP_BASE_INTERVAL, ADD_STAGGER_DELAY } from '../config';
import { StepPlayer } from '../engines/stepPlayer';

interface GraphControlsReturn {
  executeStep: (step: Step, stepIndex: number, options?: { immediate?: boolean }) => number;
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
    setActiveTimelineEvents,
    setTimelineAnimations,
    setDisplayText,
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
      activeTimelineEvents: state.activeTimelineEvents,
      timelineAnimations: state.timelineAnimations,
      highlightedNodes: state.highlightedNodes,
      highlightedEdges: state.highlightedEdges
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

  const executeStep = useCallback((step: Step, stepIndex: number, options?: { immediate?: boolean }) => {
    try {
      const immediate = options?.immediate === true;
      const current = getCurrentState();
      let newNodes = new Map(current.nodes);
      let newEdges = [...current.edges];
      let newVisibleNodeIds = new Set(current.visibleNodeIds);
      let newVisibleEdgeIds = new Set(current.visibleEdgeIds);
      let newNodeAnimations = new Map(current.nodeAnimations);
      let newActiveTimelineEvents = [...current.activeTimelineEvents];
      let newTimelineAnimations = new Map(current.timelineAnimations);

      const nodesToAdd = (step.add && Array.isArray(step.add))
        ? step.add.filter(node => node && node.id)
        : [];

      // 节点数据立刻写入；可见性按 add 顺序 stagger（跳转步骤时 immediate 一次全显）
      nodesToAdd.forEach((node, index) => {
        newNodes.set(node.id, node);

        if (immediate || index === 0) {
          newVisibleNodeIds.add(node.id);
          if (!immediate) {
            newNodeAnimations.set(node.id, step.animate?.type || 'fade');
          }
        }
      });

      if (step.connect && Array.isArray(step.connect)) {
        step.connect.forEach(edge => {
          if (edge && edge.from && edge.to) {
            if (!newEdges.some(e => e.from === edge.from && e.to === edge.to)) {
              newEdges.push(edge);
            }
            if (immediate || nodesToAdd.length <= 1) {
              newVisibleEdgeIds.add(`${edge.from}-${edge.to}`);
            }
          }
        });
      }

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

      if (step.remove && Array.isArray(step.remove)) {
        step.remove.forEach(id => {
          if (id) newVisibleNodeIds.delete(id);
        });

        const edgesToRemove = new Set(step.remove!);
        newEdges.forEach(edge => {
          if (edgesToRemove.has(edge.from) || edgesToRemove.has(edge.to)) {
            newVisibleEdgeIds.delete(`${edge.from}-${edge.to}`);
          }
        });
      }

      setNodes(newNodes);
      setEdges(newEdges);
      setVisibleNodeIds(newVisibleNodeIds);
      setVisibleEdgeIds(newVisibleEdgeIds);
      setNodeAnimations(newNodeAnimations);
      setActiveTimelineEvents(newActiveTimelineEvents);
      setTimelineAnimations(newTimelineAnimations);

      // 清理第一步入场动画标记
      if (!immediate && nodesToAdd.length > 0) {
        const firstId = nodesToAdd[0].id;
        const animDuration = step.animate?.duration || NODE_ANIMATION_DURATION;
        setTimeout(() => {
          const currentAnims = useStore.getState().nodeAnimations;
          if (!currentAnims.has(firstId)) return;
          const newMap = new Map(currentAnims);
          newMap.delete(firstId);
          setNodeAnimations(newMap);
        }, animDuration);
      }

      // 后续节点 / 边依次入场
      if (!immediate && nodesToAdd.length > 1) {
        const animType = step.animate?.type || 'fade';
        const animDuration = step.animate?.duration || NODE_ANIMATION_DURATION;

        nodesToAdd.slice(1).forEach((node, offset) => {
          const delay = (offset + 1) * ADD_STAGGER_DELAY;
          setTimeout(() => {
            if (useStore.getState().currentStep !== stepIndex) return;

            const state = useStore.getState();
            const visible = new Set(state.visibleNodeIds);
            visible.add(node.id);
            setVisibleNodeIds(visible);

            const anims = new Map(state.nodeAnimations);
            anims.set(node.id, animType);
            setNodeAnimations(anims);

            setTimeout(() => {
              const currentAnims = useStore.getState().nodeAnimations;
              if (!currentAnims.has(node.id)) return;
              const next = new Map(currentAnims);
              next.delete(node.id);
              setNodeAnimations(next);
            }, animDuration);
          }, delay);
        });

        // 边在最后一个节点开始出现后再显示，避免连线「悬空」
        if (step.connect && Array.isArray(step.connect) && step.connect.length > 0) {
          const edgeDelay = (nodesToAdd.length - 1) * ADD_STAGGER_DELAY;
          setTimeout(() => {
            if (useStore.getState().currentStep !== stepIndex) return;

            const state = useStore.getState();
            const visible = new Set(state.visibleEdgeIds);
            step.connect!.forEach(edge => {
              if (edge?.from && edge?.to) {
                visible.add(`${edge.from}-${edge.to}`);
              }
            });
            setVisibleEdgeIds(visible);
          }, edgeDelay);
        }
      }

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
  }, [getCurrentState, setNodes, setEdges, setVisibleNodeIds, setVisibleEdgeIds, setNodeAnimations, setActiveTimelineEvents, setTimelineAnimations, setHighlightedNodes, setHighlightedEdges]);

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
