import React, { useState } from 'react';

interface MobileBallControlProps {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onReplay: () => void;
  isPlaying: boolean;
  volume: number;
}

export const MobileBallControl: React.FC<MobileBallControlProps> = ({
  onPlay,
  onPause,
  onPrev,
  onNext,
  onSpeedChange,
  onVolumeChange,
  onReplay,
  isPlaying,
  volume
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    setShowSpeedMenu(false);
  };

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
    setShowSpeedMenu(false);
  };

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const getVolumeIcon = () => {
    return volume === 0 ? '🔇' : '🔊';
  };

  const toggleVolume = () => {
    onVolumeChange(volume === 0 ? 1 : 0);
  };

  return (
    <div className="mobile-ball-control">
      <div className={`mobile-ball-backdrop ${isOpen ? 'active' : ''}`} onClick={toggleMenu} />

      <div className={`mobile-ball-menu ${isOpen ? 'active' : ''}`}>
        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(onPrev)}
        >
          <span className="mobile-ball-item-icon prev">⏮</span>
          <span className="mobile-ball-item-label">上一步</span>
        </button>

        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(isPlaying ? onPause : onPlay)}
        >
          <span className={`mobile-ball-item-icon ${isPlaying ? 'pause' : 'play'}`}>
            {isPlaying ? '⏸' : '▶'}
          </span>
          <span className="mobile-ball-item-label">{isPlaying ? '暂停' : '播放'}</span>
        </button>

        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(onNext)}
        >
          <span className="mobile-ball-item-icon next">⏭</span>
          <span className="mobile-ball-item-label">下一步</span>
        </button>

        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(onReplay)}
        >
          <span className="mobile-ball-item-icon replay">🔄</span>
          <span className="mobile-ball-item-label">重播</span>
        </button>

        <button
          className="mobile-ball-item"
          onClick={() => {
            setShowSpeedMenu(!showSpeedMenu);
          }}
        >
          <span className="mobile-ball-item-icon speed">⚡</span>
          <span className="mobile-ball-item-label">速度</span>
          <span className="mobile-ball-item-shortcut">1x</span>
        </button>

        {showSpeedMenu && (
          <div className="mobile-ball-speed-menu">
            {speedOptions.map(speed => (
              <button
                key={speed}
                className="mobile-ball-speed-option"
                onClick={() => {
                  onSpeedChange(speed);
                  setShowSpeedMenu(false);
                  setIsOpen(false);
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}

        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(toggleVolume)}
        >
          <span className="mobile-ball-item-icon volume">{getVolumeIcon()}</span>
          <span className="mobile-ball-item-label">音量</span>
          <span className="mobile-ball-item-shortcut">{volume === 0 ? '关闭' : '开启'}</span>
        </button>
      </div>

      <button
        className={`mobile-ball-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label="打开控制菜单"
      >
        <div className="mobile-ball-icon">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
    </div>
  );
};

export default MobileBallControl;
