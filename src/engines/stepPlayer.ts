import { Step, DSL } from '../types';
import { useStore, PlayMode } from '../stores/store';
import { ttsService } from '../services/ttsService';
import {
  TTS_ANIMATION_DELAY,
  STEP_MIN_DURATION,
  TYPING_BASE_DELAY,
  TYPING_PER_CHAR_DELAY,
  STEP_BASE_INTERVAL
} from '../config';

type ExecuteStepFn = (step: Step, stepIndex: number) => number;
type StartTypingFn = (text: string, onComplete?: () => void) => void;

interface StepPlayerConfig {
  executeStep: ExecuteStepFn;
  startTyping: StartTypingFn;
  onStepComplete?: (stepIndex: number) => void;
  onAllStepsComplete?: () => void;
}

class StepPlayer {
  private config: StepPlayerConfig;
  private isInitialized: boolean = false;
  private animationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private nonTtsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private sessionId: number = 0;
  private lastPlaySessionId: number = 0;
  private expectedNextStepIndex: number = -1;

  constructor(config: StepPlayerConfig) {
    this.config = config;
  }

  private newSession() {
    this.sessionId++;
    return this.sessionId;
  }

  private isCurrentSession(id: number) {
    return id === this.sessionId;
  }

  init() {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    this.setupTTSCallback();
  }

  private setupTTSCallback() {
    ttsService.setSpeakEndCallback(() => {
      this.handleTTSEnd();
    });

    ttsService.setTTSErrorCallback(() => {
      useStore.getState().setTtsEnabled(false);
    });
  }

  private handleTTSEnd() {
    const state = useStore.getState();
    
    if (!state.isAutoPlaying || !state.playMode) {
      return;
    }

    if (!this.isCurrentSession(this.lastPlaySessionId)) {
      return;
    }

    if (this.animationTimeoutId) {
      clearTimeout(this.animationTimeoutId);
      this.animationTimeoutId = null;
    }

    if (this.nonTtsTimeoutId) {
      clearTimeout(this.nonTtsTimeoutId);
      this.nonTtsTimeoutId = null;
    }

    const currentSessionId = this.sessionId;
    const { ttsEnabled, ttsAutoPlay } = useStore.getState();
    
    if (!ttsEnabled || !ttsAutoPlay) {
      const currentStepIndex = state.currentStep;
      const dsl = state.dsl;
      
      if (dsl && dsl.steps && currentStepIndex >= 0 && currentStepIndex < dsl.steps.length) {
        const currentStep = dsl.steps[currentStepIndex];
        const text = currentStep.text || '';
        
        const typingDuration = text.length > 0
          ? TYPING_BASE_DELAY + text.length * TYPING_PER_CHAR_DELAY
          : 0;
        const totalDuration = Math.max(typingDuration, STEP_BASE_INTERVAL) + STEP_MIN_DURATION;
        
        setTimeout(() => {
          if (this.isCurrentSession(currentSessionId) && useStore.getState().isAutoPlaying && !useStore.getState().isPaused) {
            this.playNextInQueue();
          }
        }, totalDuration);
      } else {
        setTimeout(() => {
          if (this.isCurrentSession(currentSessionId)) {
            this.playNextInQueue();
          }
        }, STEP_MIN_DURATION);
      }
      return;
    }

    setTimeout(() => {
      if (this.isCurrentSession(currentSessionId)) {
        this.playNextInQueue();
      }
    }, STEP_MIN_DURATION);
  }

  private playNextInQueue() {
    const state = useStore.getState();
    
    if (!state.isAutoPlaying || !state.playMode) {
      return;
    }

    const expectedIndex = this.expectedNextStepIndex;
    if (expectedIndex >= 0 && state.playedStepCount !== expectedIndex) {
      return;
    }

    if (state.playMode === 'incremental') {
      const nextStep = state.shiftPendingStep();
      if (nextStep) {
        const nextIndex = state.playedStepCount;
        this.playStepInternal(nextStep, nextIndex);
      }
    } else if (state.playMode === 'replay') {
      const dsl = state.dsl;
      if (!dsl || !dsl.steps) return;
      
      const nextIndex = state.playedStepCount;
      if (nextIndex < dsl.steps.length) {
        this.playStepInternal(dsl.steps[nextIndex], nextIndex);
      } else {
        this.completePlayback();
      }
    }
  }

  private playStepInternal(step: Step, stepIndex: number) {
    const state = useStore.getState();
    
    if (state.isPaused) {
      return;
    }

    const currentSessionId = this.sessionId;
    this.lastPlaySessionId = currentSessionId;

    useStore.getState().setCurrentStep(stepIndex);
    useStore.getState().incrementPlayedStepCount();
    this.expectedNextStepIndex = stepIndex + 1;

    const text = step.text || '';
    const { ttsEnabled, ttsAutoPlay } = useStore.getState();

    if (ttsEnabled && ttsAutoPlay) {
      if (this.nonTtsTimeoutId) {
        clearTimeout(this.nonTtsTimeoutId);
        this.nonTtsTimeoutId = null;
      }

      useStore.getState().setDisplayText(text);
      ttsService.speak(text);

      this.animationTimeoutId = setTimeout(() => {
        if (this.isCurrentSession(currentSessionId) && useStore.getState().isAutoPlaying && !useStore.getState().isPaused) {
          this.config.executeStep(step, stepIndex);
        }
      }, TTS_ANIMATION_DELAY);
    } else {
      if (this.animationTimeoutId) {
        clearTimeout(this.animationTimeoutId);
        this.animationTimeoutId = null;
      }

      this.config.startTyping(text);
      this.config.executeStep(step, stepIndex);

      const typingDuration = text.length > 0
        ? TYPING_BASE_DELAY + text.length * TYPING_PER_CHAR_DELAY
        : 0;

      const totalDuration = Math.max(typingDuration, STEP_BASE_INTERVAL) + STEP_MIN_DURATION;

      this.nonTtsTimeoutId = setTimeout(() => {
        if (this.isCurrentSession(currentSessionId) && useStore.getState().isAutoPlaying && !useStore.getState().isPaused) {
          this.playNextInQueue();
        }
      }, totalDuration);
    }

    this.config.onStepComplete?.(stepIndex);
  }

  private completePlayback() {
    useStore.getState().setIsAutoPlaying(false);
    useStore.getState().setPlayMode(null);
    this.config.onAllStepsComplete?.();
  }

  startIncrementalMode() {
    this.stop();
    this.newSession();
    
    const store = useStore.getState();
    store.resetGraphDisplay();
    store.setPlayMode('incremental');
    store.setIsAutoPlaying(true);
    store.setPlayedStepCount(0);
    
    this.init();
  }

  addStepsToQueue(steps: Step[]) {
    const state = useStore.getState();
    
    if (state.playMode !== 'incremental') {
      console.warn('[StepPlayer] 非增量模式，无法添加步骤到队列');
      return;
    }

    const isFirstStep = state.playedStepCount === 0 && state.pendingSteps.length === 0;
    
    useStore.getState().addPendingSteps(steps);

    if (isFirstStep && steps.length > 0) {
      const firstStep = useStore.getState().shiftPendingStep();
      if (firstStep) {
        this.playStepInternal(firstStep, 0);
      }
    }
  }

  startReplay(dsl: DSL) {
    this.stop();
    this.newSession();

    const store = useStore.getState();
    store.resetGraphState();
    store.setDsl(dsl);
    store.setPlayMode('replay');
    store.setIsAutoPlaying(true);
    store.setPlayedStepCount(0);
    
    this.init();

    if (dsl.steps && dsl.steps.length > 0) {
      setTimeout(() => {
        this.playStepInternal(dsl.steps[0], 0);
      }, 50);
    }
  }

  stop() {
    if (this.animationTimeoutId) {
      clearTimeout(this.animationTimeoutId);
      this.animationTimeoutId = null;
    }

    if (this.nonTtsTimeoutId) {
      clearTimeout(this.nonTtsTimeoutId);
      this.nonTtsTimeoutId = null;
    }

    ttsService.stop();
    useStore.getState().stopPlayback();
  }

  pause() {
    useStore.getState().setIsPaused(true);
    ttsService.pause();
  }

  resume() {
    useStore.getState().setIsPaused(false);
    ttsService.resume();
  }

  jumpToStep(stepIndex: number) {
    const state = useStore.getState();
    if (!state.dsl || stepIndex < 0 || stepIndex >= state.dsl.steps.length) return;

    this.stop();

    const store = useStore.getState();
    store.resetGraphDisplay();
    store.setCurrentStep(stepIndex);
    store.setPlayedStepCount(stepIndex + 1);

    for (let i = 0; i <= stepIndex; i++) {
      this.config.executeStep(state.dsl.steps[i], i);
    }

    const lastStep = state.dsl.steps[stepIndex];
    const text = lastStep.text || '';
    useStore.getState().setDisplayText(text);

    const { ttsEnabled, ttsAutoPlay } = useStore.getState();
    if (ttsEnabled && ttsAutoPlay && text) {
      ttsService.speak(text);
    }
  }

  nextStep() {
    const state = useStore.getState();
    if (!state.dsl) return;
    
    const nextIndex = state.currentStep + 1;
    if (nextIndex < state.dsl.steps.length) {
      this.jumpToStep(nextIndex);
    }
  }

  prevStep() {
    const state = useStore.getState();
    if (!state.dsl) return;
    
    const prevIndex = state.currentStep - 1;
    if (prevIndex >= 0) {
      this.jumpToStep(prevIndex);
    }
  }

  getPlayMode(): PlayMode {
    return useStore.getState().playMode;
  }

  isPlaying(): boolean {
    return useStore.getState().isAutoPlaying;
  }
}

export type { StepPlayerConfig };
export { StepPlayer };
