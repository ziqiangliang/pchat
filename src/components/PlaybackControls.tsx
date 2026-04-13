import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../stores/store';
import { ttsService } from '../services/ttsService';

interface PlaybackControlsProps {
  totalSteps: number;
  currentStep: number;
  onJumpToStep: (stepIndex: number) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  currentText?: string;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  totalSteps,
  currentStep,
  onJumpToStep,
  onPrevStep,
  onNextStep,
  currentText = ''
}) => {
  const { t } = useTranslation();
  const { isPaused, setIsPaused, playbackSpeed, setPlaybackSpeed } = useStore();
  const { ttsEnabled, setTtsEnabled, ttsState, setTtsState, ttsAutoPlay, setTtsAutoPlay } = useStore();
  const [showTtsSettings, setShowTtsSettings] = useState(false);

  useEffect(() => {
    ttsService.setStateChangeCallback((state) => {
      setTtsState(state);
    });

    ttsService.setTTSErrorCallback(() => {
      setTtsEnabled(false);
    });
  }, [setTtsState, setTtsEnabled]);

  useEffect(() => {
    if (isPaused) {
      ttsService.pause();
    } else if (ttsEnabled && ttsState.isPaused) {
      ttsService.resume();
    }
  }, [isPaused, ttsEnabled, ttsState.isPaused]);

  useEffect(() => {
    if (ttsEnabled && ttsAutoPlay && currentText && !isPaused) {
      const timer = setTimeout(() => {
        if (ttsEnabled && ttsAutoPlay && currentText && !isPaused) {
          ttsService.speak(currentText, { rate: playbackSpeed });
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [currentText, ttsEnabled, ttsAutoPlay, playbackSpeed, isPaused]);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    ttsService.setRate(speed);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stepIndex = parseInt(e.target.value, 10);
    onJumpToStep(stepIndex);
  };

  const handleTtsToggle = () => {
    if (ttsEnabled) {
      ttsService.stop();
      setTtsEnabled(false);
    } else {
      setTtsEnabled(true);
      if (currentText) {
        ttsService.speak(currentText, { rate: playbackSpeed });
      }
    }
  };

  const handleTtsPauseResume = () => {
    if (ttsState.isPaused) {
      ttsService.resume();
    } else {
      ttsService.pause();
    }
  };

  const handleTtsStop = () => {
    ttsService.stop();
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    ttsService.setVoice(e.target.value);
  };

  const handleTtsRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    ttsService.setRate(parseFloat(e.target.value));
  };

  const getProgressPercentage = () => {
    if (totalSteps === 0) return 0;
    return ((currentStep + 1) / totalSteps) * 100;
  };

  return (
    <div className="playback-controls">
      <div className="playback-controls__header">
        <div className="playback-controls__main">
          <button
            className="playback-btn playback-btn--pause"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? t('playback.resume') : t('playback.pause')}
          >
            {isPaused ? '▶' : '⏸'}
          </button>

          <button
            className="playback-btn"
            onClick={onPrevStep}
            disabled={currentStep <= 0}
            title={t('playback.prevStep')}
          >
            ⏮
          </button>

          <button
            className="playback-btn"
            onClick={onNextStep}
            disabled={currentStep >= totalSteps - 1}
            title={t('playback.nextStep')}
          >
            ⏭
          </button>

          <select
            className="playback-speed"
            value={playbackSpeed}
            onChange={handleSpeedChange}
            title={t('playback.speed')}
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
          </select>

          <div className="playback-divider" />

          <button
            className={`playback-btn playback-btn--tts ${ttsEnabled ? 'active' : ''}`}
            onClick={handleTtsToggle}
            title={ttsEnabled ? t('tts.disable') : t('tts.enable')}
          >
            🔊
          </button>

          {ttsEnabled && ttsState.isSpeaking && (
            <>
              <button
                className="playback-btn"
                onClick={handleTtsPauseResume}
                title={ttsState.isPaused ? t('tts.resumeVoice') : t('tts.pauseVoice')}
              >
                {ttsState.isPaused ? '▶' : '⏸'}
              </button>
              <button
                className="playback-btn"
                onClick={handleTtsStop}
                title={t('tts.stopVoice')}
              >
                ⏹
              </button>
            </>
          )}

          {ttsEnabled && (
            <button
              className="playback-btn"
              onClick={() => setShowTtsSettings(!showTtsSettings)}
              title={t('tts.settings')}
            >
              ⚙
            </button>
          )}
        </div>

        <div className="playback-controls__progress">
          <span className="playback-step-info">
            {t('playback.stepInfo', { current: currentStep + 1, total: totalSteps })}
          </span>
          <div className="playback-slider-container">
            <input
              type="range"
              min="0"
              max={totalSteps - 1}
              value={currentStep}
              onChange={handleSliderChange}
              className="playback-slider"
            />
            <div
              className="playback-slider-progress"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {showTtsSettings && ttsEnabled && (
          <div className="tts-settings">
            <div className="tts-settings__row">
              <label className="tts-settings__label">{t('tts.voice')}</label>
              <select
                className="tts-settings__select"
                value={ttsState.selectedVoice?.voiceURI || ''}
                onChange={handleVoiceChange}
              >
                {ttsState.availableVoices
                  .filter(voice => voice.lang.includes('zh') || voice.lang.includes('en'))
                  .map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
              </select>
            </div>

            <div className="tts-settings__row">
              <label className="tts-settings__label">{t('tts.rate')}</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={ttsState.rate}
                onChange={handleTtsRateChange}
                className="tts-settings__slider"
              />
              <span className="tts-settings__value">{ttsState.rate.toFixed(1)}x</span>
            </div>

            <div className="tts-settings__row">
              <label className="tts-settings__label">{t('tts.autoPlay')}</label>
              <button
                className={`tts-settings__toggle ${ttsAutoPlay ? 'active' : ''}`}
                onClick={() => setTtsAutoPlay(!ttsAutoPlay)}
              >
                {ttsAutoPlay ? t('tts.on') : t('tts.off')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
