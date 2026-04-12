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
  private speakTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastSpokenText: string = '';
  private fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.supported = 'speechSynthesis' in window && !isProblematicBrowser();
    this.state.isSupported = this.supported;
    
    if (this.supported) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
      
      if (this.synthesis!.onvoiceschanged !== undefined) {
        this.synthesis!.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synthesis) return;
    
    const voices = this.synthesis.getVoices();
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

    if (this.speakTimeoutId) {
      clearTimeout(this.speakTimeoutId);
      this.speakTimeoutId = null;
    }

    if (this.fallbackTimeoutId) {
      clearTimeout(this.fallbackTimeoutId);
      this.fallbackTimeoutId = null;
    }

    if (text === this.lastSpokenText && this.state.isSpeaking) {
      return;
    }

    this.stop(true);

    if (!this.supported || !this.synthesis) {
      this.fallbackSpeak(text);
      return;
    }

    this.lastSpokenText = text;
    this.performSpeak(text, options);
  }

  private fallbackSpeak(text: string) {
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

      this.utterance.onstart = () => {
        this.state.isSpeaking = true;
        this.state.isPaused = false;
        this.state.currentText = text;
        this.notifyStateChange();
        
        if (this.onSpeakStart) {
          this.onSpeakStart();
        }
      };

      this.utterance.onend = () => {
        if (this.speakTimeoutId) {
          clearTimeout(this.speakTimeoutId);
          this.speakTimeoutId = null;
        }
        this.state.isSpeaking = false;
        this.state.isPaused = false;
        if (this.state.currentText === text) {
          this.state.currentText = '';
        }
        this.notifyStateChange();

        if (this.onSpeakEnd) {
          this.onSpeakEnd();
        }
      };

      this.utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') {
          return;
        }
        
        console.warn('TTS Error:', event.error);
        this.state.isSpeaking = false;
        this.state.isPaused = false;
        this.notifyStateChange();
        
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

      this.synthesis.speak(this.utterance);

      this.speakTimeoutId = setTimeout(() => {
        if (this.state.isSpeaking) {
          console.warn('TTS timeout, forcing end');
          this.stop();
          if (this.onSpeakEnd) {
            this.onSpeakEnd();
          }
        }
      }, TTS_TIMEOUT);

    } catch (error) {
      console.warn('TTS speak error:', error);
      this.state.isSpeaking = false;
      this.state.isPaused = false;
      this.notifyStateChange();
      
      if (this.onSpeakEnd) {
        this.onSpeakEnd();
      }
    }
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
    if (this.speakTimeoutId) {
      clearTimeout(this.speakTimeoutId);
      this.speakTimeoutId = null;
    }
    
    if (this.fallbackTimeoutId) {
      clearTimeout(this.fallbackTimeoutId);
      this.fallbackTimeoutId = null;
    }
    
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
