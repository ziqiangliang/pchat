import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { useStore } from './stores/store';
import { DSL, Step, ChatMessage } from './types';
import { GraphCanvas } from './components/GraphCanvas';
import { ChatInterface } from './components/ChatInterface';
import { PlaybackControls } from './components/PlaybackControls';
import { DraggablePlaybackControls } from './components/DraggablePlaybackControls';
import { MobileBallControl } from './components/MobileBallControl';
import { ttsService } from './services/ttsService';
import { ttsManager } from './services/ttsManager';
import { safeParseDSL, extractStreamingSteps } from './utils/jsonParser';
import { useGraphControls } from './hooks/useGraphControls';
import { DSL_SYSTEM_PROMPT } from './config/prompts';
import './index.css';

function App() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const isPaused = useStore(state => state.isPaused);
  const setIsPaused = useStore(state => state.setIsPaused);
  const ttsEnabled = useStore(state => state.ttsEnabled);
  const setTtsEnabled = useStore(state => state.setTtsEnabled);

  const {
    handleClear,
    handleJumpToStep,
    handlePrevStep,
    handleNextStep,
    stepPlayer
  } = useGraphControls();

  const handlePlay = useCallback(() => {
    setIsPaused(false);
    stepPlayer.resume();
  }, [setIsPaused, stepPlayer]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    stepPlayer.pause();
  }, [setIsPaused, stepPlayer]);

  const handleReplay = useCallback(() => {
    if (dsl) {
      resetGraphState();
      stepPlayer.startReplay(dsl);
    }
  }, [dsl, resetGraphState, stepPlayer]);

  const handleVolumeChange = useCallback((vol: number) => {
    ttsService.setVolume(vol);
    if (vol === 0) {
      ttsManager.stop();
      setTtsEnabled(false);
    } else {
      setTtsEnabled(true);
    }
  }, [setTtsEnabled]);

  const handlePasteJson = useCallback(() => {
    if (!pastedJson.trim()) {
      alert('请先粘贴JSON代码');
      return;
    }

    const result = safeParseDSL(pastedJson);

    if (!result.success) {
      alert('JSON格式错误: ' + (result.error || '请检查格式'));
      return;
    }

    resetGraphState();
    setDsl(result.data!);
    setShowJsonPanel(false);
    setPastedJson('');
    stepPlayer.startReplay(result.data!);
    setMobileMenuOpen(false);
  }, [pastedJson, resetGraphState, setDsl, setShowJsonPanel, setPastedJson, stepPlayer]);

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
              }
            }
          }
        }

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

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIGenerate();
    }
  }, [handleAIGenerate]);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      <header className="header">
        <div className="header-left">
          <button
            className={`menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="菜单"
          >
            <span className="menu-toggle-line"></span>
            <span className="menu-toggle-line"></span>
            <span className="menu-toggle-line"></span>
          </button>

          <div className="logo">
            <div className="logo-icon">{t('app.logoIcon')}</div>
            <div className="logo-text">
              <span className="logo-title">{t('app.title').split(' - ')[0]}</span>
              <span className="logo-subtitle">{t('app.title').split(' - ')[1]}</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {import.meta.env.DEV && (
            <button
              onClick={() => setShowJsonPanel(!showJsonPanel)}
              className={`btn btn-ghost ${showJsonPanel ? 'active' : ''}`}
            >
              <span>🗂️</span>
              <span>{t('controls.pasteJson')}</span>
            </button>
          )}
          <button onClick={handleReplay} className="btn btn-secondary">
            <span>🔄</span>
            <span>{t('controls.replay')}</span>
          </button>
          <button onClick={handleClear} className="btn btn-ghost btn-icon">
            <span>🗑️</span>
          </button>
          <button onClick={toggleLanguage} className="btn btn-ghost lang-toggle">
            {i18n.language === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </header>

      <div className={`mobile-menu-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={closeMobileMenu}>
        <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-menu-header">
            <span className="mobile-menu-title">菜单</span>
            <button className="mobile-menu-close" onClick={closeMobileMenu}>✕</button>
          </div>
          <div className="mobile-menu-items">
            {import.meta.env.DEV && (
              <button className="mobile-menu-item" onClick={() => { setShowJsonPanel(true); closeMobileMenu(); }}>
                <span className="mobile-menu-item-icon">🗂️</span>
                <span className="mobile-menu-item-text">{t('controls.pasteJson')}</span>
              </button>
            )}
            <button className="mobile-menu-item" onClick={() => { handleReplay(); closeMobileMenu(); }}>
              <span className="mobile-menu-item-icon">🔄</span>
              <span className="mobile-menu-item-text">{t('controls.replay')}</span>
            </button>
            <button className="mobile-menu-item" onClick={() => { handleClear(); closeMobileMenu(); }}>
              <span className="mobile-menu-item-icon">🗑️</span>
              <span className="mobile-menu-item-text">{t('controls.clear')}</span>
            </button>
            <div className="mobile-menu-divider"></div>
            <button className="mobile-menu-item" onClick={() => { toggleLanguage(); closeMobileMenu(); }}>
              <span className="mobile-menu-item-icon">🌐</span>
              <span className="mobile-menu-item-text">{i18n.language === 'zh' ? 'English' : '中文'}</span>
            </button>
          </div>
        </div>
      </div>

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
          <div className="canvas-card">
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
              onPrevStep={handlePrevStep}
              onNextStep={handleNextStep}
            />

            {(dsl || isLoading) && dsl && dsl.steps && dsl.steps.length > 0 && (
              <>
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
                <MobileBallControl
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onPrev={handlePrevStep}
                  onNext={handleNextStep}
                  onVolumeChange={handleVolumeChange}
                  onReplay={handleReplay}
                  isPlaying={!isPaused}
                  volume={ttsEnabled ? 1 : 0}
                />
              </>
            )}
          </div>
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
