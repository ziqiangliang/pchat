import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { useStore } from './stores/store';
import { useAuthStore } from './stores/authStore';
import { DSL, Step, ChatMessage } from './types';
import { GraphCanvas } from './components/GraphCanvas';
import { ChatInterface } from './components/ChatInterface';
import { PlaybackControls } from './components/PlaybackControls';
import { DraggablePlaybackControls } from './components/DraggablePlaybackControls';
import { MobileBallControl } from './components/MobileBallControl';
import { LoginModal } from './components/LoginModal';
import { ttsService } from './services/ttsService';
import { safeParseDSL, extractStreamingSteps } from './utils/jsonParser';
import { useGraphControls } from './hooks/useGraphControls';
import { API_ENDPOINTS, getAuthHeaders } from './config/api';
import './index.css';

function App() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { isAuthenticated, checkAuth, user } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
  const edgeAnimations = useStore(state => state.edgeAnimations);
  const activeTimelineEvents = useStore(state => state.activeTimelineEvents);
  const timelineAnimations = useStore(state => state.timelineAnimations);
  const displayText = useStore(state => state.displayText);
  const resetGraphState = useStore(state => state.resetGraphState);
  const isDarkMode = useStore(state => state.isDarkMode);
  const isPaused = useStore(state => state.isPaused);
  const setIsPaused = useStore(state => state.setIsPaused);
  const setPlaybackSpeed = useStore(state => state.setPlaybackSpeed);
  const coordVisible = useStore(state => state.coordVisible);
  const mathPoints = useStore(state => state.mathPoints);
  const mathLines = useStore(state => state.mathLines);
  const mathCurves = useStore(state => state.mathCurves);
  const visibleMathIds = useStore(state => state.visibleMathIds);
  const mathAnimations = useStore(state => state.mathAnimations);
  const highlightedMathIds = useStore(state => state.highlightedMathIds);
  const [volume, setVolume] = useState(1);

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

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, [setPlaybackSpeed]);

  const handleReplay = useCallback(() => {
    if (dsl) {
      resetGraphState();
      stepPlayer.startReplay(dsl);
    }
  }, [dsl, resetGraphState, stepPlayer]);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    ttsService.setVolume(vol);
  }, []);

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

    if (!isAuthenticated) {
      setShowLoginModal(true);
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
      const response = await fetch(API_ENDPOINTS.chat, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders() as Record<string, string>)
        },
        body: JSON.stringify({ message: userInput })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('今日使用次数已达上限，请升级到付费版');
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let actualContent = '';
        let isDslParsed = false;
        let assistantMessageId: string | null = null;
        let lastParsedStepsCount = 0;

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
                const content = data;
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
                      const displayTextContent = [
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
                            displayContent: displayTextContent
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

        if (!isDslParsed && actualContent) {
          const finalResult = safeParseDSL(actualContent);
          if (finalResult.success && finalResult.data) {
            setDsl(finalResult.data);

            const displayTextContent = finalResult.data.steps.map((s: any) => s.text).join('\n');
            if (assistantMessageId) {
              setChatHistory(prev => {
                const updatedHistory = [...prev];
                const assistantMsgIndex = updatedHistory.findIndex(
                  msg => msg.role === 'assistant' && msg.timestamp.toString() === assistantMessageId
                );
                if (assistantMsgIndex !== -1) {
                  updatedHistory[assistantMsgIndex] = {
                    ...updatedHistory[assistantMsgIndex],
                    displayContent: displayTextContent
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

    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: error.message || t('chat.error'),
        timestamp: Date.now()
      };
      setChatHistory(prev => [...(Array.isArray(prev) ? prev : []), newUserMessage, errorMessage]);
      setIsLoading(false);
      setLoadingStartTime(null);
    }
  }, [userInput, isLoading, isAuthenticated, setDsl, setChatHistory, setUserInput, setIsLoading, setLoadingStartTime, stepPlayer]);

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
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

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
          {!isAuthenticated ? (
            <button
              onClick={() => setShowLoginModal(true)}
              className="btn btn-primary"
            >
              {t('auth.login')}
            </button>
          ) : (
            <span className="user-info">
              {user?.nickname || user?.email}
              <button
                onClick={() => useAuthStore.getState().logout()}
                className="btn btn-ghost"
              >
                {t('auth.logout')}
              </button>
            </span>
          )}
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
            {!isAuthenticated ? (
              <button className="mobile-menu-item" onClick={() => { setShowLoginModal(true); closeMobileMenu(); }}>
                <span className="mobile-menu-item-icon">🔑</span>
                <span className="mobile-menu-item-text">{t('auth.login')}</span>
              </button>
            ) : (
              <button className="mobile-menu-item" onClick={() => { useAuthStore.getState().logout(); closeMobileMenu(); }}>
                <span className="mobile-menu-item-icon">🚪</span>
                <span className="mobile-menu-item-text">{t('auth.logout')}</span>
              </button>
            )}
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
              edgeAnimations={edgeAnimations}
              activeTimelineEvents={activeTimelineEvents}
              timelineAnimations={timelineAnimations}
              currentText={displayText}
              currentStep={currentStep}
              coordVisible={coordVisible}
              mathPoints={mathPoints}
              mathLines={mathLines}
              mathCurves={mathCurves}
              visibleMathIds={visibleMathIds}
              mathAnimations={mathAnimations}
              highlightedMathIds={highlightedMathIds}
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
                  onSpeedChange={handleSpeedChange}
                  onVolumeChange={handleVolumeChange}
                  onReplay={handleReplay}
                  isPlaying={!isPaused}
                  volume={volume}
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
