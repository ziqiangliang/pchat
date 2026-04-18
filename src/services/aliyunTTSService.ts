export interface AliyunTTSConfig {
  appKey: string;
  token: string;
  voice: string;
  volume: number;
  speechRate: number;
  pitchRate: number;
}

export interface AliyunTTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  progress: number;
  error: string | null;
}

class AliyunTTSService {
  private config: AliyunTTSConfig = {
    appKey: import.meta.env.VITE_ALIYUN_APP_KEY || '',
    token: import.meta.env.VITE_ALIYUN_TOKEN || '',
    voice: import.meta.env.VITE_ALIYUN_VOICE || 'xiaoyun',
    volume: 50,
    speechRate: 0,
    pitchRate: 0,
  };

  private state: AliyunTTSState = {
    isPlaying: false,
    isPaused: false,
    currentText: '',
    progress: 0,
    error: null,
  };

  private audioElement: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private listeners: Array<(state: AliyunTTSState) => void> = [];

  public subscribe(listener: (state: AliyunTTSState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  public get isSupported(): boolean {
    return !!this.config.appKey && !!this.config.token;
  }

  public get currentState(): AliyunTTSState {
    return { ...this.state };
  }

  public updateConfig(newConfig: Partial<AliyunTTSConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): AliyunTTSConfig {
    return { ...this.config };
  }

  private generateAudioUrl(text: string): string {
    const params = new URLSearchParams({
      appkey: this.config.appKey,
      token: this.config.token,
      text: text,
      voice: this.config.voice,
      volume: String(this.config.volume),
      speech_rate: String(this.config.speechRate),
      pitch_rate: String(this.config.pitchRate),
      format: 'mp3',
    });

    return `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts?${params.toString()}`;
  }

  public async speak(text: string): Promise<void> {
    if (!this.isSupported) {
      this.state.error = '阿里云 TTS 未配置';
      this.notifyListeners();
      throw new Error(this.state.error);
    }

    try {
      this.stop();
      
      this.state.currentText = text;
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.state.error = null;
      this.state.progress = 0;
      this.notifyListeners();

      const audioUrl = this.generateAudioUrl(text);
      this.currentAudioUrl = audioUrl;

      this.audioElement = new Audio(audioUrl);
      
      this.audioElement.onended = () => {
        this.state.isPlaying = false;
        this.state.progress = 100;
        this.notifyListeners();
      };

      this.audioElement.onerror = (error) => {
        this.state.error = '音频播放失败';
        this.state.isPlaying = false;
        this.notifyListeners();
        console.error('Aliyun TTS Error:', error);
      };

      this.audioElement.ontimeupdate = () => {
        if (this.audioElement) {
          const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
          this.state.progress = isNaN(progress) ? 0 : progress;
          this.notifyListeners();
        }
      };

      await this.audioElement.play();
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : '播放失败';
      this.state.isPlaying = false;
      this.notifyListeners();
      throw error;
    }
  }

  public pause(): void {
    if (this.audioElement && this.state.isPlaying && !this.state.isPaused) {
      this.audioElement.pause();
      this.state.isPaused = true;
      this.notifyListeners();
    }
  }

  public resume(): void {
    if (this.audioElement && this.state.isPaused) {
      this.audioElement.play();
      this.state.isPaused = false;
      this.notifyListeners();
    }
  }

  public stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
    
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.progress = 0;
    this.notifyListeners();
  }

  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(100, volume));
    if (this.audioElement) {
      this.audioElement.volume = this.config.volume / 100;
    }
  }

  public setSpeechRate(rate: number): void {
    this.config.speechRate = Math.max(-500, Math.min(500, rate));
  }

  public setPitchRate(rate: number): void {
    this.config.pitchRate = Math.max(-500, Math.min(500, rate));
  }
}

export const aliyunTTSService = new AliyunTTSService();
export default aliyunTTSService;
