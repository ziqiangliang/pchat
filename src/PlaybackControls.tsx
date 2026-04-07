import React from 'react';
import { useStore } from './store';

interface PlaybackControlsProps {
  totalSteps: number;
  currentStep: number;
  onJumpToStep: (stepIndex: number) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  totalSteps,
  currentStep,
  onJumpToStep,
  onPrevStep,
  onNextStep
}) => {
  const { isPaused, setIsPaused, playbackSpeed, setPlaybackSpeed } = useStore();

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPlaybackSpeed(parseFloat(e.target.value));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stepIndex = parseInt(e.target.value, 10);
    onJumpToStep(stepIndex);
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
            title={isPaused ? '继续播放' : '暂停播放'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>

          <button
            className="playback-btn"
            onClick={onPrevStep}
            disabled={currentStep <= 0}
            title="上一步"
          >
            ⏮
          </button>

          <button
            className="playback-btn"
            onClick={onNextStep}
            disabled={currentStep >= totalSteps - 1}
            title="下一步"
          >
            ⏭
          </button>

          <select
            className="playback-speed"
            value={playbackSpeed}
            onChange={handleSpeedChange}
            title="播放速度"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
          </select>
        </div>

        <div className="playback-controls__progress">
          <span className="playback-step-info">
            Step {currentStep + 1} / {totalSteps}
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
      </div>
    </div>
  );
};
