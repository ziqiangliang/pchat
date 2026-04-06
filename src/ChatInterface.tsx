import React, { useEffect, useState, useRef } from 'react';
import { ChatMessage } from './types';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  userInput: string;
  isLoading: boolean;
  loadingStartTime: number | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatHistory,
  userInput,
  isLoading,
  loadingStartTime,
  onInputChange,
  onSend,
  onKeyPress
}) => {
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const finalDurationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading || !loadingStartTime) {
      return;
    }

    const updateTimer = () => {
      setCurrentElapsed(Date.now() - loadingStartTime);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [isLoading, loadingStartTime]);

  useEffect(() => {
    if (isLoading === false && loadingStartTime !== null) {
      finalDurationRef.current = Date.now() - loadingStartTime;
      setCurrentElapsed(finalDurationRef.current);
    }
  }, [isLoading, loadingStartTime]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const lastAssistantIndex = chatHistory.length - 1 - [...chatHistory].reverse().findIndex(m => m.role === 'assistant');

  return (
    <div className="content-area">
      <div className="chat-history">
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <p>{message.content}</p>
            {message.role === 'assistant' && index === lastAssistantIndex && !isLoading && (
              <div className="message-timer">
                耗时 {formatDuration(currentElapsed)}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="loading">
            <span className="loading-dot">·</span>
            <span className="loading-dot">·</span>
            <span className="loading-dot">·</span>
            {loadingStartTime && (
              <span className="loading-timer">
                {formatDuration(currentElapsed)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="input-area">
        <textarea
          value={userInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="输入你的问题..."
          disabled={isLoading}
        />
        <button onClick={onSend} disabled={isLoading || !userInput.trim()}>
          {isLoading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
};
