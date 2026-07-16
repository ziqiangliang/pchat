import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  userInput: string;
  isLoading: boolean;
  isStreaming?: boolean;
  loadingStartTime: number | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatHistory,
  userInput,
  isLoading,
  isStreaming = false,
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

  const safeChatHistory = Array.isArray(chatHistory) ? chatHistory : [];
  const lastAssistantIndex = safeChatHistory.length > 0
    ? safeChatHistory.length - 1 - [...safeChatHistory].reverse().findIndex(m => m.role === 'assistant')
    : -1;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-title">
          <div className="chat-header-icon">💬</div>
          <span>{t('chat.title')}</span>
        </div>
        <div className="chat-status">
          <div className="chat-status-dot"></div>
          <span>{t('chat.online')}</span>
        </div>
      </div>

      <div className="content-area">
        <div className="chat-history">
          {safeChatHistory.map((message, index) => (
            <div
              key={message.timestamp}
              className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="message-bubble">
                {message.role === 'assistant'
                  ? (message.displayContent !== undefined && message.displayContent.length > 0 ? message.displayContent : '')
                  : message.content}
              </div>
              <div className="message-time">
                {message.role === 'assistant' && index === lastAssistantIndex && !isLoading ? (
                  t('chat.duration') + ' ' + formatDuration(currentElapsed)
                ) : (
                  '刚刚'
                )}
              </div>
              {message.role === 'assistant' && (
                <div className="message-actions">
                  <button
                    className="message-action"
                    onClick={() => {
                      const textToCopy = message.role === 'assistant'
                        ? (message.displayContent !== undefined && message.displayContent.length > 0 ? message.displayContent : message.content)
                        : message.content;
                      handleCopyMessage(textToCopy, message.timestamp);
                    }}
                    title={copiedMessageId === message.timestamp ? t('chat.copySuccess') : t('chat.copy')}
                  >
                    {copiedMessageId === message.timestamp ? '✓' : '📋'}
                  </button>
                  {import.meta.env.DEV && (
                    <button
                      className="message-action"
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
                </div>
              )}
              {import.meta.env.DEV && message.role === 'assistant' && (
                <pre
                  id={`json-${message.timestamp}`}
                  className="json-raw-content"
                  style={{ display: 'none' }}
                >
                  {message.content}
                </pre>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="loading">
              <div className="loading-dots">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </div>
              <span className="loading-text">
                {isStreaming ? t('chat.streaming') : t('chat.loading')}
              </span>
              {loadingStartTime && (
                <span className="loading-timer">
                  {formatDuration(currentElapsed)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={userInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder={t('chat.placeholder')}
              disabled={isLoading}
            />
            <button
              className="chat-send-btn"
              onClick={onSend}
              disabled={isLoading || !userInput.trim()}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
