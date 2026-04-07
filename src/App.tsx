import React, { useEffect, useRef, useCallback } from 'react';
import { useStore } from './store';
import { DSL, Step, ChatMessage, Node, Edge, AnimationType, TimelineEvent } from './types';
import { GraphCanvas } from './GraphCanvas';
import { ChatInterface } from './ChatInterface';
import { PlaybackControls } from './PlaybackControls';
import { DraggablePlaybackControls } from './DraggablePlaybackControls';
import {
  TIMELINE_DURATION,
  NODE_ANIMATION_DURATION,
  STEP_BASE_INTERVAL,
  TIMELINE_EVENT_DELAY,
  TYPING_BASE_DELAY,
  TYPING_PER_CHAR_DELAY
} from './config';
import { safeParseDSL, extractStreamingSteps } from './utils/jsonParser';
import './index.css';

function App() {
  const {
    // UI状态
    userInput,
    setUserInput,
    chatHistory,
    setChatHistory,
    isLoading,
    setIsLoading,
    loadingStartTime,
    setLoadingStartTime,
    pastedJson,
    setPastedJson,
    showJsonPanel,
    setShowJsonPanel,

    // 图状态
    dsl,
    setDsl,
    currentStep,
    setCurrentStep,
    nodes,
    setNodes,
    edges,
    setEdges,
    visibleNodeIds,
    setVisibleNodeIds,
    visibleEdgeIds,
    setVisibleEdgeIds,
    highlightedNodes,
    setHighlightedNodes,
    highlightedEdges,
    setHighlightedEdges,
    nodeAnimations,
    setNodeAnimations,
    activeTimelineEvents,
    setActiveTimelineEvents,
    timelineAnimations,
    setTimelineAnimations,
    displayText,
    setDisplayText,
    resetGraphState,
    resetGraphDisplay
  } = useStore();

  const intervalRef = useRef<number | null>(null);
  const typingRef = useRef<number | null>(null);

  // 清理函数：组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      if (typingRef.current) {
        clearTimeout(typingRef.current);
        typingRef.current = null;
      }
    };
  }, []);

  // 获取当前状态用于更新
  const getCurrentState = useCallback(() => {
    const state = useStore.getState();
    return {
      nodes: state.nodes,
      edges: state.edges,
      visibleNodeIds: state.visibleNodeIds,
      visibleEdgeIds: state.visibleEdgeIds,
      nodeAnimations: state.nodeAnimations,
      activeTimelineEvents: state.activeTimelineEvents,
      timelineAnimations: state.timelineAnimations,
      highlightedNodes: state.highlightedNodes,
      highlightedEdges: state.highlightedEdges
    };
  }, []);

  // 打字机效果
  const startTypingEffect = useCallback((fullText: string, onComplete?: () => void) => {
    if (typingRef.current) {
      clearTimeout(typingRef.current);
      typingRef.current = null;
    }

    if (!fullText) {
      setDisplayText('');
      onComplete?.();
      return;
    }

    let charIndex = 0;
    const typeNextChar = () => {
      charIndex++;
      setDisplayText(fullText.substring(0, charIndex));

      if (charIndex < fullText.length) {
        typingRef.current = window.setTimeout(typeNextChar, TYPING_PER_CHAR_DELAY);
      } else {
        typingRef.current = null;
        onComplete?.();
      }
    };

    typingRef.current = window.setTimeout(typeNextChar, TYPING_BASE_DELAY);
  }, [setDisplayText]);

  // 执行单个步骤
  const executeStep = useCallback((step: Step) => {
    try {
      const current = getCurrentState();
      let newNodes = new Map<string, Node>(current.nodes);
      let newEdges: Edge[] = [...current.edges];
      let newVisibleNodeIds = new Set<string>(current.visibleNodeIds);
      let newVisibleEdgeIds = new Set<string>(current.visibleEdgeIds);
      let newNodeAnimations = new Map<string, AnimationType>(current.nodeAnimations);
      let newActiveTimelineEvents: TimelineEvent[] = [...current.activeTimelineEvents];
      let newTimelineAnimations = new Map<string, { progress: number }>(current.timelineAnimations);

      // 添加节点
      if (step.add && Array.isArray(step.add)) {
        step.add.forEach(node => {
          if (node && node.id) {
            newNodes.set(node.id, node);
            newVisibleNodeIds.add(node.id);
          }
        });

        // 节点动画
        if (step.animate && step.animate.type && step.add) {
          step.add.forEach(node => {
            if (node && node.id) {
              newNodeAnimations.set(node.id, step.animate!.type);
            }
          });

          // 动画结束后清除 - 使用当前状态获取
          step.add.forEach(node => {
            if (node && node.id) {
              setTimeout(() => {
                // 直接获取当前动画状态并删除
                const currentAnims = useStore.getState().nodeAnimations;
                const newMap = new Map(currentAnims);
                newMap.delete(node.id!);
                setNodeAnimations(newMap);
              }, step.animate!.duration || NODE_ANIMATION_DURATION);
            }
          });
        }
      }

      // 连接边
      if (step.connect && Array.isArray(step.connect)) {
        step.connect.forEach(edge => {
          if (edge && edge.from && edge.to) {
            if (!newEdges.some(e => e.from === edge.from && e.to === edge.to)) {
              newEdges.push(edge);
            }
            newVisibleEdgeIds.add(`${edge.from}-${edge.to}`);
          }
        });
      }

      // 高亮
      if (step.highlight && Array.isArray(step.highlight)) {
        setHighlightedNodes(new Set(step.highlight));

        const highlightedEdgeSet = new Set<string>();
        newEdges.forEach(edge => {
          if (step.highlight!.includes(edge.from) || step.highlight!.includes(edge.to)) {
            highlightedEdgeSet.add(`${edge.from}-${edge.to}`);
          }
        });
        setHighlightedEdges(highlightedEdgeSet);
      }

      // 移除节点
      if (step.remove && Array.isArray(step.remove)) {
        step.remove.forEach(id => {
          if (id) newVisibleNodeIds.delete(id);
        });

        const edgesToRemove = new Set(step.remove!);
        newEdges.forEach(edge => {
          if (edgesToRemove.has(edge.from) || edgesToRemove.has(edge.to)) {
            newVisibleEdgeIds.delete(`${edge.from}-${edge.to}`);
          }
        });
      }

      // 应用所有状态更新
      setNodes(newNodes);
      setEdges(newEdges);
      setVisibleNodeIds(newVisibleNodeIds);
      setVisibleEdgeIds(newVisibleEdgeIds);
      setNodeAnimations(newNodeAnimations);
      setActiveTimelineEvents(newActiveTimelineEvents);
      setTimelineAnimations(newTimelineAnimations);

      // 时间线事件
      if (step.timeline && Array.isArray(step.timeline)) {
        step.timeline.forEach((event, index) => {
          if (!event || !event.id) return;

          const delay = (event.delay || 0) + index * TIMELINE_EVENT_DELAY;

          setTimeout(() => {
            const prevEvents = useStore.getState().activeTimelineEvents;
            if (!prevEvents.some((e: TimelineEvent) => e.id === event.id)) {
              setActiveTimelineEvents([...prevEvents, event]);
            }

            const prevTimeAnims = useStore.getState().timelineAnimations;
            const newMap = new Map(prevTimeAnims);
            newMap.set(event.id, { progress: 0 });
            setTimelineAnimations(newMap);

            const startTime = Date.now();

            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / TIMELINE_DURATION, 1);

              const currAnims = useStore.getState().timelineAnimations;
              const animMap = new Map(currAnims);
              animMap.set(event.id, { progress });
              setTimelineAnimations(animMap);

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setTimeout(() => {
                  const finalAnims = useStore.getState().timelineAnimations;
                  const finalMap = new Map(finalAnims);
                  finalMap.delete(event.id!);
                  setTimelineAnimations(finalMap);
                }, STEP_BASE_INTERVAL);
              }
            };

            requestAnimationFrame(animate);
          }, delay);
        });
      }

      // 打字机效果
      const text = step.text || '';
      const typingDuration = text.length > 0 ? TYPING_BASE_DELAY + text.length * TYPING_PER_CHAR_DELAY : 0;
      startTypingEffect(text);
      return typingDuration;
    } catch (error) {
      console.error('Error executing step:', error);
      return 0;
    }
  }, [getCurrentState, setNodes, setEdges, setVisibleNodeIds, setVisibleEdgeIds, setNodeAnimations, setActiveTimelineEvents, setTimelineAnimations, setHighlightedNodes, setHighlightedEdges, startTypingEffect]);

  // 流式播放单个步骤（用于流式增量渲染）
  const playSingleStep = useCallback((step: Step, stepIndex: number) => {
    setCurrentStep(stepIndex);
    return executeStep(step);
  }, [executeStep, setCurrentStep]);

  // 播放所有步骤
  const playAllSteps = useCallback((targetDsl?: DSL) => {
    const dslToPlay = targetDsl || dsl;
    if (!dslToPlay) return;

    console.log('[重播] dsl.steps.length:', dslToPlay.steps?.length);
    console.log('[重播] steps:', JSON.stringify(dslToPlay.steps?.map(s => s.text?.substring(0, 20))));

    // 清理之前的定时器
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    // 重置状态
    resetGraphState();
    setDsl(dslToPlay);

    setTimeout(() => {
      let stepIndex = 0;
      const steps = dslToPlay.steps;

      const runStep = () => {
        if (stepIndex < steps.length) {
          console.log(`[重播] 执行步骤 ${stepIndex + 1}/${steps.length}`);
          const step = steps[stepIndex];
          setCurrentStep(stepIndex);
          const typingDuration = executeStep(step);
          stepIndex++;

          const baseInterval = STEP_BASE_INTERVAL;
          const interval = Math.max(baseInterval, typingDuration + STEP_BASE_INTERVAL);
          intervalRef.current = window.setTimeout(runStep, interval);
        } else {
          console.log('[重播] 完成');
          intervalRef.current = null;
        }
      };

      setTimeout(runStep, 50);
    }, 50);
  }, [dsl, resetGraphState, setDsl, setCurrentStep, executeStep]);

  // 处理粘贴 JSON
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
    playAllSteps(result.data!);
  }, [pastedJson, resetGraphState, setDsl, setShowJsonPanel, setPastedJson, playAllSteps]);

  // 处理 AI 生成
  const handleAIGenerate = useCallback(async () => {
    if (!userInput.trim() || isLoading) return;

    const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

    if (!deepseekApiKey) {
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
              content: `你是一个"可视化讲解脚本生成器"。你的任务是把用户的问题，转换成一个"逐步讲解的 DSL（JSON格式）"。目标是用"边讲边画"的方式，让用户理解一个概念或过程。

DSL 结构：
{
  "title": "标题",
  "meta": { "domain": "领域标签" },
  "layoutHints": { "type": "布局类型" },
  "steps": [
    {
      "text": "讲解文字",
      "add": [{ "id": "节点ID", "label": "文字", "type": "节点类型", "x": x, "y": y }],
      "connect": [{ "from": "ID", "to": "ID", "label": "标签" }],
      "highlight": ["节点ID"],
      "timeline": [{ "id": "事件ID", "from": "起始节点", "to": "目标节点", "label": "标签" }]
    }
  ]
}

节点类型：vertex(蓝色圆形), concept(浅灰矩形), dataPoint(绿色圆形), annotation(黄色矩形), process(橙色矩形)
边类型：straight, arrow, curve, diagonal
布局类型：geometry(几何), flow(流程), network(网络), data(数据)
领域标签：mathematics(数学), software_engineering(软件工程), physics(物理), general(通用)

强制规则：
1. 只输出 JSON，不要解释，不要包含 markdown 代码块标记
2. 每个 step 必须有 text
3. 节点 ID 必须简洁
4. 必须指定节点坐标 x 和 y
5. 步骤必须有清晰的教学顺序
6. 画布尺寸 800x500，中心点 400,250
7. 所有节点都在 steps 的 add 中逐步添加，所有边都在 connect 中逐步添加`
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
        let playedStepCount = 0;
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
                    
                    // 调试：检查是否有非 JSON 前缀
                    if (actualContent.includes('```')) {
                      console.log('[警告] 内容包含 ``` 标记');
                    }

                    if (completedSteps.length > 0) {
                      // 每次解析成功时都更新 DSL（确保最终保存所有 steps）
                      const partialDsl: DSL = {
                        steps: completedSteps as any[]
                      };
                      setDsl(partialDsl);
                      console.log('[流式] DSL已更新, steps:', completedSteps.length);
                      
                      // 第一次解析成功时重置图形
                      if (playedStepCount === 0 && completedSteps.length > 0) {
                        console.log('[流式] 第一次解析成功，重置图形');
                        resetGraphState();
                      }

                      // 计算新增的 steps
                      const newStepsCount = completedSteps.length - lastParsedStepsCount;
                      
                      console.log(`[流式] newStepsCount = ${completedSteps.length} - ${lastParsedStepsCount} = ${newStepsCount}`);

                      if (newStepsCount > 0) {
                        console.log(`[流式] 新增 ${newStepsCount} 个steps`);
                        // 播放新增的 steps
                        for (let i = 0; i < newStepsCount; i++) {
                          const stepIndex = lastParsedStepsCount + i;
                          const step = completedSteps[stepIndex];
                          const delay = i * STEP_BASE_INTERVAL;

                          const timeoutId = setTimeout(() => {
                            playSingleStep(step as any, stepIndex);
                            playedStepCount = Math.max(playedStepCount, stepIndex + 1);
                          }, delay);

                          pendingTimeouts.push(timeoutId);
                        }

                        lastParsedStepsCount = completedSteps.length;
                      }

                      // 如果 steps 完整，标记为已解析
                      if (isComplete && playedStepCount >= completedSteps.length) {
                        console.log('[流式] 标记为已解析 isDslParsed=true');
                        isDslParsed = true;
                        clearPendingTimeouts();
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
            resetGraphState();
            setDsl(finalResult.data);
            console.log('[保存到store后] dsl已设置');

            // 播放所有 steps
            const steps = finalResult.data.steps;
            if (steps && steps.length > 0) {
              steps.forEach((step, index) => {
                const timeoutId = setTimeout(() => {
                  playSingleStep(step, index);
                }, index * STEP_BASE_INTERVAL);
                pendingTimeouts.push(timeoutId);
              });
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
  }, [userInput, isLoading, chatHistory, resetGraphState, setDsl, playAllSteps, setChatHistory, setUserInput, setIsLoading, setLoadingStartTime]);

  // 键盘事件
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIGenerate();
    }
  }, [handleAIGenerate]);

  // 清空
  const handleClear = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    if (typingRef.current) {
      clearTimeout(typingRef.current);
      typingRef.current = null;
    }

    resetGraphState();
    setDsl(null);
  }, [resetGraphState, setDsl]);

  // 跳转到指定步骤
  const handleJumpToStep = useCallback((stepIndex: number) => {
    if (!dsl || stepIndex < 0 || stepIndex >= dsl.steps.length) return;

    resetGraphDisplay();
    setCurrentStep(stepIndex);

    for (let i = 0; i <= stepIndex; i++) {
      executeStep(dsl.steps[i]);
    }
  }, [dsl, resetGraphDisplay, setCurrentStep, executeStep]);

  // 上一步
  const handlePrevStep = useCallback(() => {
    if (currentStep > 0) {
      handleJumpToStep(currentStep - 1);
    }
  }, [currentStep, handleJumpToStep]);

  // 下一步
  const handleNextStep = useCallback(() => {
    if (dsl && currentStep < dsl.steps.length - 1) {
      handleJumpToStep(currentStep + 1);
    }
  }, [currentStep, dsl, handleJumpToStep]);

  return (
    <div className="app">
      <header className="header">
        <h1>PChat - 智能图形化讲解助手</h1>
        <div className="controls">
          <button
            onClick={() => setShowJsonPanel(!showJsonPanel)}
            style={{ background: showJsonPanel ? '#3b82f6' : '#64748b' }}
          >
            {showJsonPanel ? '关闭后门' : '粘贴JSON'}
          </button>
          <button onClick={handleClear}>
            清空
          </button>
          {dsl && (
            <button onClick={() => playAllSteps()}>
              重播
            </button>
          )}
        </div>
      </header>

      {showJsonPanel && (
        <div className="json-panel" style={{
          background: '#f1f5f9',
          padding: '20px',
          margin: '10px',
          borderRadius: '8px',
          border: '2px solid #3b82f6'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>粘贴JSON代码</h3>
          <textarea
            value={pastedJson}
            onChange={(e) => setPastedJson(e.target.value)}
            placeholder="在此粘贴JSON代码..."
            style={{
              width: '100%',
              height: '200px',
              padding: '10px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'vertical',
              marginBottom: '10px'
            }}
          />
          <button
            onClick={handlePasteJson}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            渲染JSON
          </button>
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