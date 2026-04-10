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
    setActiveTimelineEvents,
    setTimelineAnimations,
    setDisplayText,
    resetGraphState
  } = useStore();

  const stepPlayerRef = useRef<StepPlayer | null>(null);

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

  const startTypingEffect = useCallback((fullText: string, onComplete?: () => void) => {
    let charIndex = 0;
    const typeNextChar = () => {
      if (useStore.getState().isPaused) {
        setTimeout(typeNextChar, 100);
        return;
      }

      charIndex++;
      setDisplayText(fullText.substring(0, charIndex));

      if (charIndex < fullText.length) {
        window.setTimeout(typeNextChar, TYPING_PER_CHAR_DELAY);
      } else {
        onComplete?.();
      }
    };

    window.setTimeout(typeNextChar, TYPING_BASE_DELAY);
  }, [setDisplayText]);

  const executeStep = useCallback((step: Step, stepIndex: number) => {
    try {
      const current = getCurrentState();
      let newNodes = new Map(current.nodes);
      let newEdges = [...current.edges];
      let newVisibleNodeIds = new Set(current.visibleNodeIds);
      let newVisibleEdgeIds = new Set(current.visibleEdgeIds);
      let newNodeAnimations = new Map(current.nodeAnimations);
      let newActiveTimelineEvents = [...current.activeTimelineEvents];
      let newTimelineAnimations = new Map(current.timelineAnimations);

      if (step.add && Array.isArray(step.add)) {
        step.add.forEach(node => {
          if (node && node.id) {
            newNodes.set(node.id, node);
            newVisibleNodeIds.add(node.id);
          }
        });

        if (step.animate && step.animate.type && step.add) {
          step.add.forEach(node => {
            if (node && node.id) {
              newNodeAnimations.set(node.id, step.animate!.type);
            }
          });

          step.add.forEach(node => {
            if (node && node.id) {
              setTimeout(() => {
                const currentAnims = useStore.getState().nodeAnimations;
                const newMap = new Map(currentAnims);
                newMap.delete(node.id!);
                setNodeAnimations(newMap);
              }, step.animate!.duration || NODE_ANIMATION_DURATION);
            }
          });
        }
      }

      if (step.connect && Array.isArray(step.connect)) {
        step.connect.forEach(edge => {
          if (edge && edge.from && edge.to) {
            if (!newEdges.some(e => e.from === edge.from && e.to === edge.to)) {
              newEdges.push(edge);
            }
            newVisibleEdgeIds.add(`${edge.from}-${edge.to}`);
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
    stepPlayerRef.current?.stop();
    resetGraphState();
    setDsl(null);
  }, [resetGraphState, setDsl]);

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
