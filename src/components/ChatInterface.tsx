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

const EXAMPLE_PROMPTS = [
  { zh: '用流程图讲解 TCP 三次握手', en: 'Explain TCP three-way handshake with a flowchart' },
  { zh: '画一个冒泡排序的步骤示意', en: 'Illustrate bubble sort step by step' },
  { zh: '解释光合作用的基本过程', en: 'Explain the basic process of photosynthesis' },
];

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
  const { t, i18n } = useTranslation();
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [expandedJsonIds, setExpandedJsonIds] = useState<Set<number>>(new Set());
  const historyEndRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      setCurrentElapsed(Date.now() - loadingStartTime);
    }
  }, [isLoading, loadingStartTime]);

  // 新消息 / 流式更新时滚到底部
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, isLoading, isStreaming]);

  // textarea 随内容增高
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [userInput]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatClock = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAssistantDisplay = (message: ChatMessage) => {
    if (message.displayContent !== undefined && message.displayContent.length > 0) {
      return message.displayContent;
    }
    return '';
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

  const toggleJson = (timestamp: number) => {
    setExpandedJsonIds(prev => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  };

  const handleExampleClick = (prompt: string) => {
    if (isLoading) return;
    onInputChange(prompt);
    textareaRef.current?.focus();
  };

  const safeChatHistory = Array.isArray(chatHistory) ? chatHistory : [];
  const lastAssistantIndex = safeChatHistory.length > 0
    ? safeChatHistory.length - 1 - [...safeChatHistory].reverse().findIndex(m => m.role === 'assistant')
    : -1;
  const isEmpty = safeChatHistory.length === 0 && !isLoading;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-title">
          <div className="chat-header-icon">💬</div>
          <span>{t('chat.title')}</span>
        </div>
        <div className={`chat-status ${isLoading ? 'busy' : ''}`}>
          <div className="chat-status-dot"></div>
          <span>{isLoading ? (isStreaming ? t('chat.streaming') : t('chat.loading')) : t('chat.online')}</span>
        </div>
      </div>

      <div className="content-area">
        <div className="chat-history" ref={historyRef}>
          {isEmpty && (
            <div className="chat-empty">
              <p className="chat-empty-title">{t('chat.emptyTitle')}</p>
              <p className="chat-empty-desc">{t('chat.emptyDesc')}</p>
              <div className="chat-examples">
                {EXAMPLE_PROMPTS.map((item) => {
                  const text = i18n.language === 'en' ? item.en : item.zh;
                  return (
                    <button
                      key={text}
                      type="button"
                      className="chat-example"
                      onClick={() => handleExampleClick(text)}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {safeChatHistory.map((message, index) => {
            const assistantText = message.role === 'assistant' ? getAssistantDisplay(message) : '';
            const isLastAssistant = message.role === 'assistant' && index === lastAssistantIndex;
            const showStreamingPlaceholder = isLastAssistant && isLoading && !assistantText;

            return (
              <div
                key={`${message.role}-${message.timestamp}-${index}`}
                className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className={`message-bubble ${showStreamingPlaceholder ? 'streaming-placeholder' : ''}`}>
                  {message.role === 'assistant'
                    ? (showStreamingPlaceholder ? t('chat.streaming') : assistantText)
                    : message.content}
                </div>
                <div className="message-meta">
                  <span className="message-time">
                    {isLastAssistant && !isLoading
                      ? `${t('chat.duration')} ${formatDuration(currentElapsed)}`
                      : formatClock(message.timestamp)}
                  </span>
                  {message.role === 'assistant' && !showStreamingPlaceholder && (
                    <div className="message-actions">
                      <button
                        className="message-action"
                        onClick={() => {
                          const textToCopy = assistantText || message.content;
                          handleCopyMessage(textToCopy, message.timestamp);
                        }}
                        title={copiedMessageId === message.timestamp ? t('chat.copySuccess') : t('chat.copy')}
                      >
                        {copiedMessageId === message.timestamp ? '✓' : '📋'}
                      </button>
                      {import.meta.env.DEV && (
                        <button
                          className="message-action"
                          onClick={() => toggleJson(message.timestamp)}
                          title="JSON"
                        >
                          {'{ }'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {import.meta.env.DEV && message.role === 'assistant' && expandedJsonIds.has(message.timestamp) && (
                  <pre className="json-raw-content">
                    {message.content}
                  </pre>
                )}
              </div>
            );
          })}

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
          <div ref={historyEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={userInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyPress}
              placeholder={t('chat.placeholder')}
              disabled={isLoading}
              rows={1}
            />
            <button
              className="chat-send-btn"
              onClick={onSend}
              disabled={isLoading || !userInput.trim()}
              aria-label={t('controls.send')}
            >
              →
            </button>
          </div>
          <div className="chat-input-hint">{t('chat.inputHint')}</div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
