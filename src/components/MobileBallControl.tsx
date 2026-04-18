import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MobileBallControlProps {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (volume: number) => void;
  onReplay: () => void;
  isPlaying: boolean;
  volume: number;
}

const VolumeIcon: React.FC<{ muted: boolean }> = ({ muted }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width="20"
    height="20"
    style={{ display: 'block' }}
  >
    {muted ? (
      <>
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </>
    ) : (
      <>
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </>
    )}
  </svg>
);

export const MobileBallControl: React.FC<MobileBallControlProps> = ({
  onPlay,
  onPause,
  onVolumeChange,
  onReplay,
  isPlaying,
  volume
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
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
          onClick={() => handleItemClick(isPlaying ? onPause : onPlay)}
        >
          <span className={`mobile-ball-item-icon ${isPlaying ? 'pause' : 'play'}`}>
            {isPlaying ? '⏸' : '▶'}
          </span>
          <span className="mobile-ball-item-label">{isPlaying ? t('mobile.pause') : t('mobile.play')}</span>
        </button>

        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(onReplay)}
        >
          <span className="mobile-ball-item-icon replay">🔄</span>
          <span className="mobile-ball-item-label">{t('mobile.replay')}</span>
        </button>

        <button
          className="mobile-ball-item"
          onClick={() => handleItemClick(toggleVolume)}
        >
          <span className="mobile-ball-item-icon volume">
            <VolumeIcon muted={volume === 0} />
          </span>
          <span className="mobile-ball-item-label">{volume === 0 ? t('mobile.mute') : t('mobile.sound')}</span>
        </button>
      </div>

      <button
        className={`mobile-ball-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label={t('mobile.openMenu')}
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
