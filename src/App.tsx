import React, { useCallback, useState } from 'react';
import { useStore } from './stores/store';
import { DSL, Step, ChatMessage, Node, Edge } from './types';
import { GraphCanvas } from './components/GraphCanvas';
import { ChatInterface } from './components/ChatInterface';
import { PlaybackControls } from './components/PlaybackControls';
import { DraggablePlaybackControls } from './components/DraggablePlaybackControls';
import { SmartChatInterface } from './components/SmartChatInterface';
import { safeParseDSL, extractStreamingSteps } from './utils/jsonParser';
import { useGraphControls } from './hooks/useGraphControls';
import { DSL_SYSTEM_PROMPT } from './config/prompts';
import './index.css';

function App() {
  const [isSmartMode, setIsSmartMode] = useState(false);

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
  const setNodes = useStore(state => state.setNodes);
  const edges = useStore(state => state.edges);
  const setEdges = useStore(state => state.setEdges);
  const visibleNodeIds = useStore(state => state.visibleNodeIds);
  const setVisibleNodeIds = useStore(state => state.setVisibleNodeIds);
  const visibleEdgeIds = useStore(state => state.visibleEdgeIds);
  const setVisibleEdgeIds = useStore(state => state.setVisibleEdgeIds);
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
      // 这里可以实现一个更加美观的错误提示组件
      alert('请设置 VITE_DEEPSEEK_API_KEY 环境变量');
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
              content: DSL_SYSTEM_PROMPT
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
                      timestamp: Date.now()
                    };
                    setChatHistory(prev => [...prev, newAssistantMessage]);
                    assistantMessageId = newAssistantMessage.timestamp.toString();
                  } else {
                    actualContent += content;
                    setChatHistory(prev => {
                      const updatedHistory = [...prev];
                      const assistantMsgIndex = updatedHistory.findIndex(
                        msg => msg.role === 'assistant' && msg.timestamp.toString() === assistantMessageId
                      );
                      if (assistantMsgIndex !== -1) {
                        updatedHistory[assistantMsgIndex] = {
                          ...updatedHistory[assistantMsgIndex],
                          content: actualContent
                        };
                      }
                      return updatedHistory;
                    });
                  }

                  // 流式解析：使用 extractStreamingSteps 提取已完成的 steps
                  if (!isDslParsed) {
                    const { completedSteps, isComplete } = extractStreamingSteps(actualContent);
                    
                    console.log(`[流式解析] content长度: ${actualContent.length}, completedSteps: ${completedSteps.length}, isComplete: ${isComplete}, lastParsed: ${lastParsedStepsCount}`);
                    
                    if (actualContent.includes('```')) {
                      console.log('[警告] 内容包含 ``` 标记');
                    }

                    if (completedSteps.length > 0) {
                      const partialDsl: DSL = {
                        steps: completedSteps as any[]
                      };
                      setDsl(partialDsl);
                      console.log('[流式] DSL已更新, steps:', completedSteps.length);
                      
                      // 第一次解析成功时启动增量模式
                      if (lastParsedStepsCount === 0 && completedSteps.length > 0) {
                        console.log('[流式] 第一次解析成功，启动增量模式');
                        stepPlayer.startIncrementalMode();
                      }

                      // 计算新增的 steps
                      const newStepsCount = completedSteps.length - lastParsedStepsCount;
                      
                      console.log(`[流式] newStepsCount = ${completedSteps.length} - ${lastParsedStepsCount} = ${newStepsCount}`);

                      if (newStepsCount > 0) {
                        console.log(`[流式] 新增 ${newStepsCount} 个steps`);
                        
                        // 将新步骤添加到播放队列
                        const newSteps = completedSteps.slice(lastParsedStepsCount);
                        stepPlayer.addStepsToQueue(newSteps as Step[]);
                        
                        lastParsedStepsCount = completedSteps.length;
                      }

                      // 如果 steps 完整，标记为已解析
                      if (isComplete) {
                        const state = useStore.getState();
                        if (state.playedStepCount >= completedSteps.length) {
                          console.log('[流式] 标记为已解析 isDslParsed=true');
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
          console.log('[AI完整输出长度]', actualContent.length);
          console.log('[AI完整输出]', actualContent);
          const finalResult = safeParseDSL(actualContent);
          console.log('[safeParseDSL success]', finalResult.success);
          if (finalResult.success && finalResult.data) {
            console.log('[AI解析成功] steps数量:', finalResult.data.steps?.length);
            console.log('[保存到store前] dsl.steps:', finalResult.data.steps?.map(s => s.text?.substring(0, 30)));
            setDsl(finalResult.data);
            console.log('[保存到store后] dsl已设置');

            // 只有当不在增量模式播放中时，才启动重播
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
        content: '抱歉，发生了错误。请稍后再试。',
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



  // 智能绘图模式的状态同步
  const handleSmartNodesUpdate = useCallback((smartNodes: Map<string, Node>) => {
    setNodes(smartNodes);
    const newVisibleIds = new Set(Array.from(smartNodes.keys()));
    setVisibleNodeIds(newVisibleIds);
  }, [setNodes, setVisibleNodeIds]);

  const handleSmartEdgesUpdate = useCallback((smartEdges: Edge[]) => {
    setEdges(smartEdges);
    const newVisibleEdgeIds = new Set(
      smartEdges.map(edge => `${edge.from}-${edge.to}`)
    );
    setVisibleEdgeIds(newVisibleEdgeIds);
  }, [setEdges, setVisibleEdgeIds]);

  const handleSmartDrawingComplete = useCallback(() => {
    console.log('Smart drawing completed');
  }, []);

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      <header className="header">
        <h1>
          <span className="logo-icon">P</span>
          <span className="title-text">PChat - 智能图形化讲解助手</span>
        </h1>
        <div className="controls">
          <button
            onClick={() => setIsSmartMode(!isSmartMode)}
            className={isSmartMode ? 'active' : ''}
            title={isSmartMode ? '切换到标准模式' : '切换到智能绘图模式'}
          >
            {isSmartMode ? '标准模式' : '智能绘图'}
          </button>
          <button
            onClick={() => setShowJsonPanel(!showJsonPanel)}
            className={showJsonPanel ? 'active' : ''}
          >
            {showJsonPanel ? '关闭后门' : '粘贴JSON'}
          </button>
          <button onClick={handleClear}>
            清空
          </button>
          {dsl && (
            <button onClick={() => stepPlayer.startReplay(dsl)}>
              重播
            </button>
          )}
        </div>
      </header>

      {showJsonPanel && (
        <div className="json-panel-overlay" onClick={() => setShowJsonPanel(false)}>
          <div className="json-panel" onClick={(e) => e.stopPropagation()}>
            <h2>粘贴JSON代码</h2>
            <textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder="在此粘贴JSON代码..."
            />
            <div className="json-panel-buttons">
              <button onClick={() => setShowJsonPanel(false)}>
                取消
              </button>
              <button onClick={handlePasteJson}>
                渲染JSON
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

        {isSmartMode ? (
          <SmartChatInterface
            onNodesUpdate={handleSmartNodesUpdate}
            onEdgesUpdate={handleSmartEdgesUpdate}
            onDrawingComplete={handleSmartDrawingComplete}
          />
        ) : (
          <ChatInterface
            chatHistory={chatHistory}
            userInput={userInput}
            isLoading={isLoading}
            loadingStartTime={loadingStartTime}
            onInputChange={setUserInput}
            onSend={handleAIGenerate}
            onKeyPress={handleKeyPress}
          />
        )}
      </main>
    </div>
  );
}

export default App;