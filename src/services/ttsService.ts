export type TTSVoice = {
  name: string;
  lang: string;
  voiceURI: string;
};

export type TTSState = {
  isSpeaking: boolean;
  isPaused: boolean;
  currentText: string;
  availableVoices: TTSVoice[];
  selectedVoice: TTSVoice | null;
  rate: number;
  pitch: number;
  volume: number;
  isSupported: boolean;
};

const TTS_TIMEOUT = 30000;
const ONSTART_TIMEOUT = 1000;
const KICK_TIMEOUT = 350;
const CANCEL_SPEAK_DELAY = 200;

function isProblematicBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('huawei') ||
         ua.includes('honor') ||
         ua.includes('harmony') ||
         (ua.includes('android') && ua.includes('micromessenger'));
}

class TTSService {
  private synthesis: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private supported: boolean = false;
  private state: TTSState = {
    isSpeaking: false,
    isPaused: false,
    currentText: '',
    availableVoices: [],
    selectedVoice: null,
    rate: 1,
    pitch: 1,
    volume: 1,
    isSupported: false
  };
  private onStateChange: ((state: TTSState) => void) | null = null;
  private onSpeakStart: (() => void) | null = null;
  private onSpeakEnd: (() => void) | null = null;
  private onTTSError: (() => void) | null = null;
  private speakTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastSpokenText: string = '';
  private fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onstartTimerId: ReturnType<typeof setTimeout> | null = null;
  private kickTimerId: ReturnType<typeof setTimeout> | null = null;
  private pendingSpeak: { text: string; options?: { rate?: number; pitch?: number; volume?: number } } | null = null;
  private isWarmedUp: boolean = false;
  private voicesLoaded: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor() {
    this.supported = 'speechSynthesis' in window && !isProblematicBrowser();
    this.state.isSupported = this.supported;

    if (this.supported) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();

      if (this.synthesis!.onvoiceschanged !== undefined) {
        this.synthesis!.onvoiceschanged = () => this.loadVoices();
      }

      document.addEventListener('click', this.handleUserInteraction, { once: true });
      document.addEventListener('touchstart', this.handleUserInteraction, { once: true });
      document.addEventListener('keydown', this.handleUserInteraction, { once: true });
    }
  }

  private handleUserInteraction = () => {
    if (!this.isWarmedUp && this.synthesis && !this.voicesLoaded) {
      this.synthesis.getVoices();
    }
    if (!this.isWarmedUp && this.synthesis) {
      this.warmupEngine();
    }
  };

  private warmupEngine() {
    try {
      const warmupUtterance = new SpeechSynthesisUtterance('');
      warmupUtterance.volume = 0;
      this.synthesis!.speak(warmupUtterance);
      setTimeout(() => {
        try { this.synthesis!.cancel(); } catch {}
        this.isWarmedUp = true;
      }, 50);
    } catch {
      this.isWarmedUp = true;
    }
  }

  private loadVoices() {
    if (!this.synthesis) return;

    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      this.voicesLoaded = true;
    }
    const ttsVoices: TTSVoice[] = voices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI
    }));
    
    this.state.availableVoices = ttsVoices;
    
    const chineseVoice = ttsVoices.find(v => 
      v.lang.includes('zh') || v.lang.includes('CN') || v.lang.includes('Chinese')
    );
    const englishVoice = ttsVoices.find(v => 
      v.lang.includes('en') || v.lang.includes('US') || v.lang.includes('GB')
    );
    
    this.state.selectedVoice = chineseVoice || englishVoice || ttsVoices[0] || null;
    
    this.notifyStateChange();
  }

  setStateChangeCallback(callback: (state: TTSState) => void) {
    this.onStateChange = callback;
  }

  setSpeakStartCallback(callback: () => void) {
    this.onSpeakStart = callback;
  }

  setSpeakEndCallback(callback: () => void) {
    this.onSpeakEnd = callback;
  }

  setTTSErrorCallback(callback: () => void) {
    this.onTTSError = callback;
  }

  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  getState(): TTSState {
    return { ...this.state };
  }

  speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
    if (!text.trim()) return;

    this.clearAllTimers();

    if (text === this.lastSpokenText && this.state.isSpeaking) {
      return;
    }

    this.pendingSpeak = { text, options };
    this.retryCount = 0;

    this.cancelInternal(true);

    if (!this.supported || !this.synthesis) {
      this.fallbackSpeak(text);
      return;
    }

    this.lastSpokenText = text;
    this.ensureThenSpeak(text, options);
  }

  private clearAllTimers() {
    if (this.speakTimeoutId) { clearTimeout(this.speakTimeoutId); this.speakTimeoutId = null; }
    if (this.fallbackTimeoutId) { clearTimeout(this.fallbackTimeoutId); this.fallbackTimeoutId = null; }
    if (this.onstartTimerId) { clearTimeout(this.onstartTimerId); this.onstartTimerId = null; }
    if (this.kickTimerId) { clearTimeout(this.kickTimerId); this.kickTimerId = null; }
  }

  private cancelInternal(silent: boolean) {
    this.clearAllTimers();
    
    if (this.synthesis) {
      try {
        this.synthesis.cancel();
      } catch (error) {
        if (!silent) {
          console.warn('TTS cancel error:', error);
        }
      }
    }
    
    this.state.isSpeaking = false;
    this.state.isPaused = false;
    this.state.currentText = '';
    this.notifyStateChange();
  }

  private ensureThenSpeak(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
    const doSpeak = () => {
      if (this.pendingSpeak?.text !== text) return;
      this.pendingSpeak = null;
      this.performSpeak(text, options);
    };

    if (!this.voicesLoaded) {
      const voices = this.synthesis!.getVoices();
      if (voices.length > 0) {
        this.loadVoices();
        doSpeak();
      } else {
        const waitForVoices = () => {
          this.synthesis!.removeEventListener('voiceschanged', waitForVoices);
          this.loadVoices();
          doSpeak();
        };
        this.synthesis!.addEventListener('voiceschanged', waitForVoices, { once: true });

        setTimeout(() => {
          if (this.pendingSpeak?.text === text) {
            this.synthesis!.removeEventListener('voiceschanged', waitForVoices);
            this.loadVoices();
            doSpeak();
          }
        }, 2000);
      }
    } else {
      setTimeout(doSpeak, CANCEL_SPEAK_DELAY);
    }
  }

  private fallbackSpeak(text: string) {
    this.pendingSpeak = null;
    this.state.isSpeaking = true;
    this.state.isPaused = false;
    this.state.currentText = text;
    this.notifyStateChange();
    
    if (this.onSpeakStart) {
      this.onSpeakStart();
    }

    const estimatedDuration = Math.max(2000, text.length * 100);
    
    this.fallbackTimeoutId = setTimeout(() => {
      this.state.isSpeaking = false;
      this.state.isPaused = false;
      this.state.currentText = '';
      this.notifyStateChange();

      if (this.onSpeakEnd) {
        this.onSpeakEnd();
      }
    }, estimatedDuration);
  }

  private performSpeak(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
    if (!this.synthesis) {
      this.fallbackSpeak(text);
      return;
    }

    try {
      this.utterance = new SpeechSynthesisUtterance(text);
      
      if (this.state.selectedVoice) {
        const voice = this.synthesis.getVoices().find(v => v.voiceURI === this.state.selectedVoice!.voiceURI);
        if (voice) {
          this.utterance.voice = voice;
        }
      }

      this.utterance.rate = options?.rate ?? this.state.rate;
      this.utterance.pitch = options?.pitch ?? this.state.pitch;
      this.utterance.volume = options?.volume ?? this.state.volume;

      let hasStarted = false;
      let currentTextRef = text;
      let kicked = false;

      this.utterance.onstart = () => {
        hasStarted = true;
        this.clearKickAndOnstartTimers();

        this.state.isSpeaking = true;
        this.state.isPaused = false;
        this.state.currentText = text;
        this.notifyStateChange();
        
        if (this.onSpeakStart) {
          this.onSpeakStart();
        }
      };

      this.utterance.onend = () => {
        this.clearKickAndOnstartTimers();
        if (this.speakTimeoutId) { clearTimeout(this.speakTimeoutId); this.speakTimeoutId = null; }
        this.state.isSpeaking = false;
        this.state.isPaused = false;
        if (this.state.currentText === currentTextRef) {
          this.state.currentText = '';
        }
        this.notifyStateChange();

        if (this.onSpeakEnd) {
          this.onSpeakEnd();
        }
      };

      this.utterance.onerror = (event) => {
        this.clearKickAndOnstartTimers();
        if (event.error === 'interrupted' || event.error === 'canceled') {
          this.state.isSpeaking = false;
          this.state.isPaused = false;
          this.state.currentText = '';
          this.notifyStateChange();

          if (this.onSpeakEnd) {
            this.onSpeakEnd();
          }
          return;
        }

        console.warn('[TTS] Error:', event.error);

        if (!hasStarted && this.retryCount < this.maxRetries) {
          console.warn('[TTS] Silent failure detected, retrying...', this.retryCount + 1, '/', this.maxRetries);
          this.retryWithFullCycle(text, options);
          return;
        }

        this.state.isSpeaking = false;
        this.state.isPaused = false;
        this.notifyStateChange();

        if (this.onTTSError) {
          this.onTTSError();
        }

        if (this.onSpeakEnd) {
          this.onSpeakEnd();
        }
      };

      this.utterance.onpause = () => {
        this.state.isPaused = true;
        this.notifyStateChange();
      };

      this.utterance.onresume = () => {
        this.state.isPaused = false;
        this.notifyStateChange();
      };

      this.kickTimerId = setTimeout(() => {
        if (!hasStarted && !kicked && this.synthesis) {
          console.log('[TTS] Kick: attempting pause/resume to unstick Chrome speech engine');
          kicked = true;
          try {
            if (this.synthesis!.speaking) {
              this.synthesis!.pause();
              setTimeout(() => {
                try { this.synthesis!.resume(); } catch {}
              }, 50);
            }
          } catch {}
        }
      }, KICK_TIMEOUT);

      this.onstartTimerId = setTimeout(() => {
        if (!hasStarted && this.state.currentText !== text) {
          return;
        }

        if (!hasStarted) {
          console.warn('[TTS] onstart timeout after kick, retrying...');
          this.retryWithFullCycle(text, options);
        }
      }, ONSTART_TIMEOUT);

      this.synthesis.speak(this.utterance);

      this.speakTimeoutId = setTimeout(() => {
        if (this.state.isSpeaking) {
          console.warn('[TTS] timeout, forcing end');
          this.stop();
          if (this.onSpeakEnd) {
            this.onSpeakEnd();
          }
        }
      }, TTS_TIMEOUT);

    } catch (error) {
      console.warn('[TTS] speak exception:', error);
      this.state.isSpeaking = false;
      this.state.isPaused = false;
      this.notifyStateChange();
      
      if (this.onSpeakEnd) {
        this.onSpeakEnd();
      }
    }
  }

  private clearKickAndOnstartTimers() {
    if (this.kickTimerId) { clearTimeout(this.kickTimerId); this.kickTimerId = null; }
    if (this.onstartTimerId) { clearTimeout(this.onstartTimerId); this.onstartTimerId = null; }
  }

  private retryWithFullCycle(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
    this.clearAllTimers();
    this.retryCount++;

    if (this.retryCount > this.maxRetries) {
      console.warn('[TTS] Max retries exceeded, falling back');
      this.fallbackSpeak(text);
      return;
    }

    this.state.isSpeaking = false;
    this.state.isPaused = false;
    this.notifyStateChange();

    try {
      this.synthesis!.cancel();
    } catch {}

    const delay = 200 * this.retryCount;

    console.log(`[TTS] Retry #${this.retryCount} after ${delay}ms delay`);

    setTimeout(() => {
      if (this.lastSpokenText === text) {
        this.performSpeak(text, options);
      }
    }, delay);
  }

  pause() {
    if (this.state.isSpeaking && !this.state.isPaused && this.synthesis) {
      this.synthesis.pause();
    }
  }

  resume() {
    if (this.state.isSpeaking && this.state.isPaused && this.synthesis) {
      this.synthesis.resume();
    }
  }

  stop(silent: boolean = false) {
    this.pendingSpeak = null;
    this.cancelInternal(silent);
  }

  setVoice(voiceURI: string) {
    const voice = this.state.availableVoices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      this.state.selectedVoice = voice;
      this.notifyStateChange();
    }
  }

  setRate(rate: number) {
    this.state.rate = Math.max(0.1, Math.min(10, rate));
    this.notifyStateChange();
  }

  setPitch(pitch: number) {
    this.state.pitch = Math.max(0, Math.min(2, pitch));
    this.notifyStateChange();
  }

  setVolume(volume: number) {
    this.state.volume = Math.max(0, Math.min(1, volume));
    this.notifyStateChange();
  }

  isSupported(): boolean {
    return this.supported;
  }
}

export const ttsService = new TTSService();
