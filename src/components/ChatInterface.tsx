import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from '../types';

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
  const { t } = useTranslation();
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
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

  const handleCopyMessage = async (content: string, timestamp: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(timestamp);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error(t('chat.copyFailed'), error);
    }
  };

  // 确保chatHistory是一个数组
  const safeChatHistory = Array.isArray(chatHistory) ? chatHistory : [];
  const lastAssistantIndex = safeChatHistory.length > 0 
    ? safeChatHistory.length - 1 - [...safeChatHistory].reverse().findIndex(m => m.role === 'assistant')
    : -1;

  return (
    <div className="content-area">
      <div className="chat-history">
        {safeChatHistory.map((message, index) => (
          <div
            key={message.timestamp}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <p>
              {message.role === 'assistant'
                ? (message.displayContent !== undefined && message.displayContent.length > 0 ? message.displayContent : '')
                : message.content}
            </p>
            {message.role === 'assistant' && (
              <>
                <button
                  className="copy-button"
                  onClick={() => {
                    const textToCopy = message.role === 'assistant'
                      ? (message.displayContent !== undefined && message.displayContent.length > 0 ? message.displayContent : message.content)
                      : message.content;
                    handleCopyMessage(textToCopy, message.timestamp);
                  }}
                  title={t('chat.copy')}
                >
                  {copiedMessageId === message.timestamp ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
                {import.meta.env.DEV && (
                  <button
                    className="json-toggle-button"
                    onClick={() => {
                      const contentEl = document.getElementById(`json-${message.timestamp}`);
                      if (contentEl) {
                        contentEl.style.display = contentEl.style.display === 'none' ? 'block' : 'none';
                      }
                    }}
                    title="JSON"
                  >
                    {'{ }'}
                  </button>
                )}
                {import.meta.env.DEV && (
                  <pre
                    id={`json-${message.timestamp}`}
                    className="json-raw-content"
                    style={{ display: 'none' }}
                  >
                    {message.content}
                  </pre>
                )}
              </>
            )}
            {message.role === 'assistant' && index === lastAssistantIndex && !isLoading && (
              <div className="message-timer">
                {t('chat.duration')} {formatDuration(currentElapsed)}
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
          placeholder={t('chat.placeholder')}
          disabled={isLoading}
        />
        <button onClick={onSend} disabled={isLoading || !userInput.trim()}>
          {isLoading ? t('chat.sending') : t('controls.send')}
        </button>
      </div>
    </div>
  );
};
