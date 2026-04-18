import { aliyunTTSService } from './aliyunTTSService';
import { ttsService } from './ttsService';

export type TTSProvider = 'native' | 'aliyun';

export interface TTSManagerState {
  provider: TTSProvider;
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  error: string | null;
}

class TTSManager {
  private currentProvider: TTSProvider;
  private listeners: Array<(state: TTSManagerState) => void> = [];
  private onSpeakEndCallback: (() => void) | null = null;
  private onTTSErrorCallback: (() => void) | null = null;
  private lastSpeakText: string = '';
  private speakPromise: Promise<void> | null = null;

  constructor() {
    this.currentProvider = aliyunTTSService.isSupported ? 'aliyun' : 'native';

    ttsService.setStateChangeCallback(() => {
      if (this.currentProvider === 'native') {
        this.notifyListeners();
      }
    });

    ttsService.setSpeakEndCallback(() => {
      if (this.onSpeakEndCallback) {
        this.onSpeakEndCallback();
      }
    });

    ttsService.setTTSErrorCallback(() => {
      if (this.onTTSErrorCallback) {
        this.onTTSErrorCallback();
      }
    });

    aliyunTTSService.subscribe(() => {
      if (this.currentProvider === 'aliyun') {
        this.notifyListeners();
      }
    });

    aliyunTTSService.setSpeakEndCallback(() => {
      if (this.onSpeakEndCallback) {
        this.onSpeakEndCallback();
      }
    });

    aliyunTTSService.setTTSErrorCallback(() => {
      if (this.onTTSErrorCallback) {
        this.onTTSErrorCallback();
      }
    });
  }

  public subscribe(listener: (state: TTSManagerState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  public getState(): TTSManagerState {
    const nativeState = ttsService.getState();
    const aliyunState = aliyunTTSService.currentState;

    if (this.currentProvider === 'aliyun') {
      return {
        provider: this.currentProvider,
        isPlaying: aliyunState.isPlaying,
        isPaused: aliyunState.isPaused,
        currentText: aliyunState.currentText,
        error: aliyunState.error,
      };
    } else {
      return {
        provider: this.currentProvider,
        isPlaying: nativeState.isSpeaking,
        isPaused: nativeState.isPaused,
        currentText: nativeState.currentText,
        error: null,
      };
    }
  }

  public get isAliyunSupported(): boolean {
    return aliyunTTSService.isSupported;
  }

  private stopAll(): void {
    aliyunTTSService.stop();
    ttsService.stop(true);
  }

  public setProvider(provider: TTSProvider): void {
    if (provider === 'aliyun' && !aliyunTTSService.isSupported) {
      console.warn('阿里云 TTS 未配置，请检查环境变量');
      return;
    }

    this.stopAll();

    this.currentProvider = provider;
    this.notifyListeners();
  }

  public getProvider(): TTSProvider {
    return this.currentProvider;
  }

  public getConfig(): { voice: string } {
    if (this.currentProvider === 'aliyun') {
      return aliyunTTSService.getConfig();
    }
    return { voice: ttsService.getState().selectedVoice?.name || 'default' };
  }

  public setSpeakEndCallback(callback: (() => void) | null): void {
    this.onSpeakEndCallback = callback;
  }

  public setTTSErrorCallback(callback: (() => void) | null): void {
    this.onTTSErrorCallback = callback;
  }

  public setRate(rate: number): void {
    if (this.currentProvider === 'aliyun') {
      aliyunTTSService.setSpeechRate(rate * 100);
    } else {
      ttsService.setRate(rate);
    }
  }

  public async speak(text: string, options?: { rate?: number }): Promise<void> {
    if (text === this.lastSpeakText && this.getState().isPlaying) {
      return;
    }

    if (this.speakPromise) {
      this.stopAll();
      try {
        await this.speakPromise;
      } catch {}
    }

    this.lastSpeakText = text;

    this.speakPromise = this.doSpeak(text, options);

    try {
      await this.speakPromise;
    } finally {
      this.speakPromise = null;
    }
  }

  private async doSpeak(text: string, options?: { rate?: number }): Promise<void> {
    try {
      this.stopAll();

      if (this.currentProvider === 'aliyun' && aliyunTTSService.isSupported) {
        if (options?.rate) {
          aliyunTTSService.setSpeechRate(options.rate * 100);
        }
        await aliyunTTSService.speak(text);
      } else {
        if (options?.rate) {
          ttsService.setRate(options.rate);
        }
        ttsService.speak(text, { rate: options?.rate });
      }
    } catch (error) {
      console.error('TTS speak error:', error);
      throw error;
    }
  }

  public pause(): void {
    if (this.currentProvider === 'aliyun') {
      aliyunTTSService.pause();
    } else {
      ttsService.pause();
    }
  }

  public resume(): void {
    if (this.currentProvider === 'aliyun') {
      aliyunTTSService.resume();
    } else {
      ttsService.resume();
    }
  }

  public stop(): void {
    this.stopAll();
    this.lastSpeakText = '';
  }
}

export const ttsManager = new TTSManager();
export default ttsManager;
