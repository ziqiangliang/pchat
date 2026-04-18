import CryptoJS from 'crypto-js';

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

interface TokenInfo {
  token: string;
  expireTime: number;
  userId: string;
}

interface AliyunCredentials {
  accessKeyId: string;
  accessKeySecret: string;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

function generateSignature(
  params: Record<string, string>,
  accessKeySecret: string,
  method: 'GET' | 'POST' = 'GET'
): string {
  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQueryString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const stringToSign = `${method}&${percentEncode('/')}&${percentEncode(canonicalizedQueryString)}`;
  const key = `${accessKeySecret}&`;
  const signature = CryptoJS.HmacSHA1(stringToSign, key);
  return CryptoJS.enc.Base64.stringify(signature);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}/, '');
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

  private credentials: AliyunCredentials = {
    accessKeyId: import.meta.env.VITE_ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: import.meta.env.VITE_ALIYUN_ACCESS_KEY_SECRET || '',
  };

  private tokenInfo: TokenInfo | null = null;
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

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
  private onSpeakEndCallback: (() => void) | null = null;
  private onTTSErrorCallback: (() => void) | null = null;
  private wasStopped: boolean = false;

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
    const hasStaticToken = !!this.config.appKey && !!this.config.token;
    const hasCredentials = !!this.config.appKey && !!this.credentials.accessKeyId && !!this.credentials.accessKeySecret;
    return hasStaticToken || hasCredentials;
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

  public updateCredentials(credentials: Partial<AliyunCredentials>): void {
    this.credentials = { ...this.credentials, ...credentials };
    this.tokenInfo = null;
    this.clearTokenRefreshTimer();
  }

  public setSpeakEndCallback(callback: (() => void) | null): void {
    this.onSpeakEndCallback = callback;
  }

  public setTTSErrorCallback(callback: (() => void) | null): void {
    this.onTTSErrorCallback = callback;
  }

  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private scheduleTokenRefresh(expireTime: number): void {
    this.clearTokenRefreshTimer();

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expireTime - now;
    const refreshTime = Math.max(timeUntilExpiry - 300, 60) * 1000;

    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        await this.fetchToken();
      } catch (error) {
        console.error('Auto refresh token failed:', error);
      }
    }, refreshTime);
  }

  public async fetchToken(): Promise<string> {
    if (!this.credentials.accessKeyId || !this.credentials.accessKeySecret) {
      if (this.config.token) {
        return this.config.token;
      }
      throw new Error('阿里云 AccessKey 未配置');
    }

    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    if (this.tokenInfo) {
      const now = Math.floor(Date.now() / 1000);
      if (this.tokenInfo.expireTime > now + 60) {
        return this.tokenInfo.token;
      }
    }

    this.tokenRefreshPromise = this.doFetchToken();

    try {
      return await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async doFetchToken(): Promise<string> {
    const timestamp = formatTimestamp(new Date());
    const signatureNonce = generateUUID();

    const params: Record<string, string> = {
      AccessKeyId: this.credentials.accessKeyId,
      Action: 'CreateToken',
      Format: 'JSON',
      RegionId: 'cn-shanghai',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: signatureNonce,
      SignatureVersion: '1.0',
      Timestamp: timestamp,
      Version: '2019-02-28',
    };

    const signature = generateSignature(params, this.credentials.accessKeySecret);
    params.Signature = signature;

    const url = `https://nls-meta.cn-shanghai.aliyuncs.com/?${Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.Code) {
      const errorMsg = data.Message || '获取 Token 失败';
      throw new Error(errorMsg);
    }

    if (!data.Token || !data.Token.Id) {
      throw new Error('Token 响应格式错误');
    }

    this.tokenInfo = {
      token: data.Token.Id,
      expireTime: data.Token.ExpireTime,
      userId: data.Token.UserId,
    };

    this.config.token = this.tokenInfo.token;

    this.scheduleTokenRefresh(this.tokenInfo.expireTime);

    console.log('Aliyun TTS Token refreshed, expires at:', new Date(this.tokenInfo.expireTime * 1000).toLocaleString());

    return this.tokenInfo.token;
  }

  private async ensureToken(): Promise<string> {
    if (this.config.token && !this.credentials.accessKeyId) {
      return this.config.token;
    }

    return this.fetchToken();
  }

  private generateAudioUrl(text: string, token: string): string {
    const params = new URLSearchParams({
      appkey: this.config.appKey,
      token: token,
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

    this.wasStopped = false;
    this.state.currentText = text;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.error = null;
    this.state.progress = 0;
    this.notifyListeners();

    try {
      const token = await this.ensureToken();

      const audioUrl = this.generateAudioUrl(text, token);
      this.currentAudioUrl = audioUrl;

      this.audioElement = new Audio(audioUrl);

      this.audioElement.onended = () => {
        this.state.isPlaying = false;
        this.state.progress = 100;
        this.notifyListeners();

        if (!this.wasStopped && this.onSpeakEndCallback) {
          this.onSpeakEndCallback();
        }
      };

      this.audioElement.onerror = (error) => {
        const wasPlaying = this.state.isPlaying;
        this.state.error = '音频播放失败';
        this.state.isPlaying = false;
        this.notifyListeners();
        console.error('Aliyun TTS Error:', error);

        if (wasPlaying && !this.wasStopped) {
          if (this.onTTSErrorCallback) {
            this.onTTSErrorCallback();
          }
          if (this.onSpeakEndCallback) {
            this.onSpeakEndCallback();
          }
        }
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Aliyun TTS play aborted');
        return;
      }
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
    this.wasStopped = true;

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

  public destroy(): void {
    this.stop();
    this.clearTokenRefreshTimer();
    this.listeners = [];
  }
}

export const aliyunTTSService = new AliyunTTSService();
export default aliyunTTSService;
