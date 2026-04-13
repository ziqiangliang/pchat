import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { useStore } from './stores/store';
import { DSL, Step, ChatMessage } from './types';
import { GraphCanvas } from './components/GraphCanvas';
import { ChatInterface } from './components/ChatInterface';
import { PlaybackControls } from './components/PlaybackControls';
import { DraggablePlaybackControls } from './components/DraggablePlaybackControls';
import { safeParseDSL, extractStreamingSteps } from './utils/jsonParser';
import { useGraphControls } from './hooks/useGraphControls';
import { DSL_SYSTEM_PROMPT } from './config/prompts';
import './index.css';

function App() {
  const { t } = useTranslation();

  // 使用selectors只订阅需要的状态
  const userInput = useStore(state => state.userInput);
  const setUserInput = useStore(state => state.setUserInput);
  const chatHistory = useStore(state => state.chatHistory);
  const setChatHistory = useStore(state => state.setChatHistory);
  const isLoading = useStore(state => state.isLoading);
  const setIsLoading = useStore(state => state.setIsLoading);
  const loadingStartTime = useStore(state => state.loadingStartTime);
  const setLoadingStartTime = useStore(state => state.setLoadingStartTime);
  const pastedJson = useStore(state => state.pastedJson);
  const setPastedJson = useStore(state => state.setPastedJson);
  const showJsonPanel = useStore(state => state.showJsonPanel);
  const setShowJsonPanel = useStore(state => state.setShowJsonPanel);
  const dsl = useStore(state => state.dsl);
  const setDsl = useStore(state => state.setDsl);
  const currentStep = useStore(state => state.currentStep);
  const nodes = useStore(state => state.nodes);
  const edges = useStore(state => state.edges);
  const visibleNodeIds = useStore(state => state.visibleNodeIds);
  const visibleEdgeIds = useStore(state => state.visibleEdgeIds);
  const highlightedNodes = useStore(state => state.highlightedNodes);
  const highlightedEdges = useStore(state => state.highlightedEdges);
  const nodeAnimations = useStore(state => state.nodeAnimations);
  const activeTimelineEvents = useStore(state => state.activeTimelineEvents);
  const timelineAnimations = useStore(state => state.timelineAnimations);
  const displayText = useStore(state => state.displayText);
  const resetGraphState = useStore(state => state.resetGraphState);
  const isDarkMode = useStore(state => state.isDarkMode);

  // 使用图形控制hook
  const {
    handleClear,
    handleJumpToStep,
    handlePrevStep,
    handleNextStep,
    stepPlayer
  } = useGraphControls();

  // 处理粘贴 JSON
  const handlePasteJson = useCallback(() => {
    if (!pastedJson.trim()) {
      // 这里可以实现一个更加美观的错误提示组件
      alert('请先粘贴JSON代码');
      return;
    }

    const result = safeParseDSL(pastedJson);

    if (!result.success) {
      // 这里可以实现一个更加美观的错误提示组件
      alert('JSON格式错误: ' + (result.error || '请检查格式'));
      return;
    }

    resetGraphState();
    setDsl(result.data!);
    setShowJsonPanel(false);
    setPastedJson('');
    stepPlayer.startReplay(result.data!);
  }, [pastedJson, resetGraphState, setDsl, setShowJsonPanel, setPastedJson, stepPlayer]);

  // 处理 AI 生成
  const handleAIGenerate = useCallback(async () => {
    if (!userInput.trim() || isLoading) return;

    const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

    if (!deepseekApiKey) {
      alert(t('chat.apiKeyRequired'));
      return;
    }

    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    };

    setChatHistory(prev => [...(Array.isArray(prev) ? prev : []), newUserMessage]);
    setUserInput('');
    setLoadingStartTime(Date.now());
    setIsLoading(true);

    try {
      const deepseekBaseUrl = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

      const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          stream: true,
          messages: [
            {
              role: 'system',
              content: DSL_SYSTEM_PROMPT.replace(
                '{{LANGUAGE_CONSTRAINT}}',
                i18n.language === 'en' ? '\n必须用英文回答所有 text 字段的内容' : ''
              )
            },
            ...(Array.isArray(chatHistory) ? chatHistory : []).map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            {
              role: 'user',
              content: userInput
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let actualContent = '';
        let isDslParsed = false;
        let assistantMessageId: string | null = null;
        let lastParsedStepsCount = 0;
        let pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

        // 清理所有待执行的定时器
        const clearPendingTimeouts = () => {
          pendingTimeouts.forEach(id => clearTimeout(id));
          pendingTimeouts = [];
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                break;
              }
              try {
                const chunkData = JSON.parse(data);
                const content = chunkData.choices[0]?.delta?.content || '';
                if (content) {
                    if (!assistantMessageId) {
                      actualContent = content;
                      const newAssistantMessage: ChatMessage = {
                        role: 'assistant',
                        content: content,
                        displayContent: '',
                        timestamp: Date.now()
                      };
                      setChatHistory(prev => [...prev, newAssistantMessage]);
                      assistantMessageId = newAssistantMessage.timestamp.toString();
                    } else {
                      actualContent += content;
                      const { completedSteps, partialStep } = extractStreamingSteps(actualContent);
                      const displayText = [
                        ...completedSteps.map((s: any) => s.text),
                        ...(partialStep ? [(partialStep as any).text] : [])
                      ].join('\n');
                      setChatHistory(prev => {
                        const updatedHistory = [...prev];
                        const assistantMsgIndex = updatedHistory.findIndex(
                          msg => msg.role === 'assistant' && msg.timestamp.toString() === assistantMessageId
                        );
                        if (assistantMsgIndex !== -1) {
                          updatedHistory[assistantMsgIndex] = {
                            ...updatedHistory[assistantMsgIndex],
                            content: actualContent,
                            displayContent: displayText
                          };
                        }
                        return updatedHistory;
                      });
                    }

                  // 流式解析：使用 extractStreamingSteps 提取已完成的 steps
                  if (!isDslParsed) {
                    const { completedSteps, isComplete } = extractStreamingSteps(actualContent);

                    if (completedSteps.length > 0) {
                      const partialDsl: DSL = {
                        steps: completedSteps as any[]
                      };
                      setDsl(partialDsl);

                      if (lastParsedStepsCount === 0 && completedSteps.length > 0) {
                        stepPlayer.startIncrementalMode();
                      }

                      const newStepsCount = completedSteps.length - lastParsedStepsCount;

                      if (newStepsCount > 0) {
                        const newSteps = completedSteps.slice(lastParsedStepsCount);
                        stepPlayer.addStepsToQueue(newSteps as Step[]);

                        lastParsedStepsCount = completedSteps.length;
                      }

                      if (isComplete) {
                        const state = useStore.getState();
                        if (state.playedStepCount >= completedSteps.length) {
                          isDslParsed = true;
                          clearPendingTimeouts();
                        }
                      }
                    }
                  }
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        // 流结束后，确保 DSL 被正确解析
        clearPendingTimeouts();
        if (!isDslParsed && actualContent) {
          const finalResult = safeParseDSL(actualContent);
          if (finalResult.success && finalResult.data) {
            setDsl(finalResult.data);

            const displayText = finalResult.data.steps.map((s: any) => s.text).join('\n');
            if (assistantMessageId) {
              setChatHistory(prev => {
                const updatedHistory = [...prev];
                const assistantMsgIndex = updatedHistory.findIndex(
                  msg => msg.role === 'assistant' && msg.timestamp.toString() === assistantMessageId
                );
                if (assistantMsgIndex !== -1) {
                  updatedHistory[assistantMsgIndex] = {
                    ...updatedHistory[assistantMsgIndex],
                    displayContent: displayText
                  };
                }
                return updatedHistory;
              });
            }

            const currentPlayMode = useStore.getState().playMode;
            if (currentPlayMode !== 'incremental') {
              const steps = finalResult.data.steps;
              if (steps && steps.length > 0) {
                stepPlayer.startReplay(finalResult.data);
              }
            }
          }
        }
      }

      setIsLoading(false);
      setLoadingStartTime(null);

    } catch (error) {
      console.error('Error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: t('chat.error'),
        timestamp: Date.now()
      };
      setChatHistory(prev => [...(Array.isArray(prev) ? prev : []), newUserMessage, errorMessage]);
      setIsLoading(false);
      setLoadingStartTime(null);
    }
  }, [userInput, isLoading, chatHistory, setDsl, setChatHistory, setUserInput, setIsLoading, setLoadingStartTime, stepPlayer]);

  // 键盘事件
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIGenerate();
    }
  }, [handleAIGenerate]);



  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  };

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      <header className="header">
        <h1>
          <span className="logo-icon">{t('app.logoIcon')}</span>
          <span className="title-text">{t('app.title')}</span>
        </h1>
        <div className="controls">
          {import.meta.env.DEV && (
            <button
              onClick={() => setShowJsonPanel(!showJsonPanel)}
              className={showJsonPanel ? 'active' : ''}
            >
              {showJsonPanel ? t('controls.closePanel') : t('controls.pasteJson')}
            </button>
          )}
          <button onClick={handleClear}>
            {t('controls.clear')}
          </button>
          {dsl && (
            <button onClick={() => stepPlayer.startReplay(dsl)}>
              {t('controls.replay')}
            </button>
          )}
          <button onClick={toggleLanguage} className="lang-toggle">
            {i18n.language === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </header>

      {import.meta.env.DEV && showJsonPanel && (
        <div className="json-panel-overlay" onClick={() => setShowJsonPanel(false)}>
          <div className="json-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{t('jsonPanel.title')}</h2>
            <textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder={t('jsonPanel.placeholder')}
            />
            <div className="json-panel-buttons">
              <button onClick={() => setShowJsonPanel(false)}>
                {t('jsonPanel.cancel')}
              </button>
              <button onClick={handlePasteJson}>
                {t('jsonPanel.render')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        <div className="canvas-area">
          <GraphCanvas
            dsl={dsl}
            nodes={nodes}
            edges={edges}
            visibleNodeIds={visibleNodeIds}
            visibleEdgeIds={visibleEdgeIds}
            highlightedNodes={highlightedNodes}
            highlightedEdges={highlightedEdges}
            nodeAnimations={nodeAnimations}
            activeTimelineEvents={activeTimelineEvents}
            timelineAnimations={timelineAnimations}
            currentText={displayText}
            currentStep={currentStep}
          />

          {(dsl || isLoading) && dsl && dsl.steps && dsl.steps.length > 0 && (
            <DraggablePlaybackControls>
              <PlaybackControls
                totalSteps={dsl.steps.length}
                currentStep={currentStep}
                onJumpToStep={handleJumpToStep}
                onPrevStep={handlePrevStep}
                onNextStep={handleNextStep}
                currentText={displayText}
              />
            </DraggablePlaybackControls>
          )}
        </div>

        <ChatInterface
          chatHistory={chatHistory}
          userInput={userInput}
          isLoading={isLoading}
          loadingStartTime={loadingStartTime}
          onInputChange={setUserInput}
          onSend={handleAIGenerate}
          onKeyPress={handleKeyPress}
        />
      </main>
    </div>
  );
}

export default App;