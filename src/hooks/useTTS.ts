import { useState, useEffect, useCallback } from 'react';
import { ttsService } from '../services/ttsService';
import { aliyunTTSService } from '../services/aliyunTTSService';
import { TTSState } from '../services/ttsService';

export type TTSProvider = 'native' | 'aliyun';

export function useTTS() {
  const [provider, setProvider] = useState<TTSProvider>('native');
  const [nativeState, setNativeState] = useState<TTSState>(() => ttsService.getState());
  const [aliyunState, setAliyunState] = useState(aliyunTTSService.currentState);
  const [isAliyunSupported] = useState(aliyunTTSService.isSupported);

  useEffect(() => {
    ttsService.setStateChangeCallback((state) => {
      setNativeState(state);
    });

    const unsubscribeAliyun = aliyunTTSService.subscribe((state) => {
      setAliyunState(state);
    });

    return () => {
      ttsService.setStateChangeCallback(() => {});
      unsubscribeAliyun();
    };
  }, []);

  const currentState = provider === 'aliyun' ? aliyunState : nativeState;

  const speak = useCallback(async (text: string, options?: { rate?: number }) => {
    try {
      if (provider === 'aliyun' && aliyunTTSService.isSupported) {
        if (options?.rate) {
          aliyunTTSService.setSpeechRate(options.rate * 100);
        }
        await aliyunTTSService.speak(text);
      } else {
        if (options?.rate) {
          ttsService.setRate(options.rate);
        }
        await ttsService.speak(text, { rate: options?.rate });
      }
    } catch (error) {
      console.error('TTS speak error:', error);
      throw error;
    }
  }, [provider]);

  const pause = useCallback(() => {
    if (provider === 'aliyun') {
      aliyunTTSService.pause();
    } else {
      ttsService.pause();
    }
  }, [provider]);

  const resume = useCallback(() => {
    if (provider === 'aliyun') {
      aliyunTTSService.resume();
    } else {
      ttsService.resume();
    }
  }, [provider]);

  const stop = useCallback(() => {
    if (provider === 'aliyun') {
      aliyunTTSService.stop();
    } else {
      ttsService.stop();
    }
  }, [provider]);

  const switchProvider = useCallback((newProvider: TTSProvider) => {
    if (newProvider === 'aliyun' && !aliyunTTSService.isSupported) {
      console.warn('阿里云 TTS 未配置，请检查环境变量');
      return;
    }
    
    stop();
    setProvider(newProvider);
  }, [stop]);

  return {
    provider,
    currentState,
    nativeState,
    aliyunState,
    isAliyunSupported,
    speak,
    pause,
    resume,
    stop,
    switchProvider,
  };
}
