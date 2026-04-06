import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import { DSL, Step, ChatMessage, Node, Edge, AnimationType, TimelineEvent } from './types';
import { GraphCanvas } from './GraphCanvas';
import { ChatInterface } from './ChatInterface';
import './index.css';

function App() {
  const {
    userInput,
    setUserInput,
    chatHistory,
    setChatHistory,
    isLoading,
    setIsLoading
  } = useStore();

  const [dsl, setDsl] = useState<DSL | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [nodes, setNodes] = useState<Map<string, Node>>(new Map());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [visibleEdgeIds, setVisibleEdgeIds] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [_currentText, setCurrentText] = useState<string>('');
  const [nodeAnimations, setNodeAnimations] = useState<Map<string, AnimationType>>(new Map());
  const [activeTimelineEvents, setActiveTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineAnimations, setTimelineAnimations] = useState<Map<string, { progress: number }>>(new Map());
  const [pastedJson, setPastedJson] = useState<string>('');
  const [showJsonPanel, setShowJsonPanel] = useState<boolean>(false);

  const intervalRef = useRef<number | null>(null);
  const typingRef = useRef<number | null>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [displayText, setDisplayText] = useState<string>('');

  useEffect(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTypingEffect = (fullText: string, onComplete?: () => void) => {
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
        typingRef.current = window.setTimeout(typeNextChar, 40);
      } else {
        typingRef.current = null;
        onComplete?.();
      }
    };
    
    typingRef.current = window.setTimeout(typeNextChar, 50);
  };

  const executeStep = (step: Step) => {
    if (step.add) {
      setNodes(prev => {
        const newMap = new Map(prev);
        step.add!.forEach(node => {
          newMap.set(node.id, node);
        });
        return newMap;
      });
      
      setVisibleNodeIds(prev => {
        const newSet = new Set(prev);
        step.add!.forEach(node => {
          newSet.add(node.id);
        });
        return newSet;
      });
      
      if (step.animate) {
        setNodeAnimations(prev => {
          const newMap = new Map(prev);
          step.add!.forEach(node => {
            newMap.set(node.id, step.animate!.type);
          });
          return newMap;
        });
        
        step.add!.forEach(node => {
          setTimeout(() => {
            setNodeAnimations(prev => {
              const newMap = new Map(prev);
              newMap.delete(node.id);
              return newMap;
            });
          }, step.animate!.duration || 500);
        });
      }
    }

    if (step.connect) {
      setEdges(prev => {
        const newEdges = [...prev];
        step.connect!.forEach(edge => {
          if (!newEdges.some(e => e.from === edge.from && e.to === edge.to)) {
            newEdges.push(edge);
          }
        });
        return newEdges;
      });
      
      setVisibleEdgeIds(prev => {
        const newSet = new Set(prev);
        step.connect!.forEach(edge => {
          newSet.add(`${edge.from}-${edge.to}`);
        });
        return newSet;
      });
    }

    if (step.highlight) {
      setHighlightedNodes(new Set(step.highlight));
      
      setHighlightedEdges(() => {
        const highlightedEdgeSet = new Set<string>();
        edges.forEach(edge => {
          if (step.highlight!.includes(edge.from) || step.highlight!.includes(edge.to)) {
            highlightedEdgeSet.add(`${edge.from}-${edge.to}`);
          }
        });
        return highlightedEdgeSet;
      });
    }

    if (step.remove) {
      setVisibleNodeIds(prev => {
        const newSet = new Set(prev);
        step.remove!.forEach(id => {
          newSet.delete(id);
        });
        return newSet;
      });
      
      setVisibleEdgeIds(prev => {
        const newSet = new Set(prev);
        const edgesToRemove = new Set(step.remove!);
        edges.forEach(edge => {
          if (edgesToRemove.has(edge.from) || edgesToRemove.has(edge.to)) {
            newSet.delete(`${edge.from}-${edge.to}`);
          }
        });
        return newSet;
      });
    }

    if (step.timeline) {
      step.timeline.forEach((event, index) => {
        const delay = (event.delay || 0) + index * 300;
        
        setTimeout(() => {
          setActiveTimelineEvents(prev => {
            if (!prev.some(e => e.id === event.id)) {
              return [...prev, event];
            }
            return prev;
          });
          
          setTimelineAnimations(prev => {
            const newMap = new Map(prev);
            newMap.set(event.id, { progress: 0 });
            return newMap;
          });
          
          const animationDuration = 800;
          const startTime = Date.now();
          
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            setTimelineAnimations(prev => {
              const newMap = new Map(prev);
              newMap.set(event.id, { progress });
              return newMap;
            });
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setTimeout(() => {
                setTimelineAnimations(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(event.id);
                  return newMap;
                });
              }, 500);
            }
          };
          
          requestAnimationFrame(animate);
        }, delay);
      });
    }

    const text = step.text || '';
    const typingDuration = text.length > 0 ? 50 + text.length * 40 : 0;
    startTypingEffect(text);
    return typingDuration;
  };

  const playAllSteps = (targetDsl?: DSL) => {
    const dslToPlay = targetDsl || dsl;
    if (!dslToPlay) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setNodes(new Map());
    setEdges([]);
    setVisibleNodeIds(new Set());
    setVisibleEdgeIds(new Set());
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setCurrentStep(-1);
    setCurrentText('');
    setDisplayText('');
    setActiveTimelineEvents([]);
    setTimelineAnimations(new Map());

    if (typingRef.current) {
      clearTimeout(typingRef.current);
      typingRef.current = null;
    }

    setTimeout(() => {
      let stepIndex = 0;
      const steps = dslToPlay.steps;
      
      const runStep = () => {
        if (stepIndex < steps.length) {
          const step = steps[stepIndex];
          setCurrentStep(stepIndex);
          const typingDuration = executeStep(step);
          stepIndex++;
          
          const baseInterval = 500;
          const interval = Math.max(baseInterval, typingDuration + 500);
          intervalRef.current = window.setTimeout(runStep, interval);
        } else {
          intervalRef.current = null;
        }
      };
      
      setTimeout(runStep, 50);
    }, 50);
  };

  const handlePasteJson = () => {
    if (!pastedJson.trim()) {
      alert('请先粘贴JSON代码');
      return;
    }

    try {
      const parsedDsl = JSON.parse(pastedJson);
      
      setNodes(new Map());
      setEdges([]);
      setVisibleNodeIds(new Set());
      setVisibleEdgeIds(new Set());
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());
      setCurrentStep(-1);
      setCurrentText('');
      setActiveTimelineEvents([]);
      setTimelineAnimations(new Map());
      
      setDsl(parsedDsl);
      setShowJsonPanel(false);
      setPastedJson('');
      playAllSteps(parsedDsl);
    } catch (e) {
      alert('JSON格式错误，请检查：' + (e as Error).message);
    }
  };

  const handleAIGenerate = async () => {
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

    setChatHistory([...chatHistory, newUserMessage]);
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
          messages: [
            {
              role: 'system',
              content: `你是一个"可视化讲解脚本生成器"。

你的任务是：
把用户的问题，转换成一个"逐步讲解的增强版 DSL（JSON格式）"。

目标：
用"边讲边画"的方式，让用户理解一个概念或过程。

====================
【DSL 结构定义】
====================

{
  "title": "标题",
  "meta": { "domain": "领域标签" },
  "nodes": [
    {
      "id": "节点ID",
      "label": "显示文字",
      "type": "节点类型",
      "style": { "color": "文字颜色", "fill": "背景颜色", "border": "边框颜色" }
    }
  ],
  "edges": [
    {
      "from": "起始节点ID",
      "to": "目标节点ID",
      "label": "连线标签（可选）",
      "type": "连线类型"
    }
  ],
  "layoutHints": {
    "type": "布局类型",
    "geometryType": "几何类型（可选）",
    "constraints": [ { "type": "约束类型", "nodes": ["节点ID列表"] } ]
  },
  "steps": [
    {
      "text": "讲解文字",
      "add": [{ "id": "节点ID", "label": "文字", "type": "节点类型" }],
      "connect": [{ "from": "ID", "to": "ID", "label": "标签" }],
      "highlight": ["节点ID"]
    }
  ]
}

====================
【节点类型说明】
====================

vertex: 几何顶点（如 A, B, C, D） - 蓝色圆形
concept: 概念节点（如 函数、变量、数据结构） - 浅灰矩形
dataPoint: 数据点、输入输出 - 绿色圆形
annotation: 标注（如角度、边长、标签） - 黄色矩形
process: 流程步骤、处理过程 - 橙色矩形

**annotation 节点必须指定 target 属性**：
- type: "node" - 指向节点，使用 nodeId
- type: "edge" - 指向边，使用 edgeId（如 "A-B"）
- type: "angle" - 指向角度，使用 angleNodes（如 ["A","B","C"]）
- position: 位置（top | bottom | left | right | auto）

====================
【边类型说明】
====================

straight: 直线连接 - 直接连接两个节点
arrow: 箭头连接 - 表示方向、流程、数据流
curve: 曲线连接 - 用于避免交叉
diagonal: 对角线 - 用于几何图形

====================
【时间线事件（timeline）】
====================

**什么时候用 timeline？**
当描述"往返通信"、"数据包传输"、"时序流程"时，用 timeline 而不是 edge！

**TCP 三次握手示例**：
{
  "steps": [
    {
      "text": "三次握手建立连接",
      "timeline": [
        { "id": "t1", "from": "client", "to": "server", "label": "SYN" },
        { "id": "t2", "from": "server", "to": "client", "label": "SYN-ACK" },
        { "id": "t3", "from": "client", "to": "server", "label": "ACK" }
      ]
    }
  ]
}

**timeline 字段说明**：
- id: 事件唯一标识
- from: 起始节点 ID（发送方）
- to: 目标节点 ID（接收方）
- label: 显示在路径上的标签
- direction: 方向（forward | backward），默认 forward
- color: 事件颜色（可选，默认粉红色）
- delay: 延迟毫秒（可选）

**⚠️ 重要**：SYN、ACK 等数据包不是节点！它们是 timeline 事件！

====================
【布局类型说明】
====================

geometry: 几何布局（数学证明、几何图形）
  - geometryType: square | triangle | circle | rectangle | polygon
  - constraints: equalLength, rightAngle, diagonalIntersect

flow: 流程布局（步骤流程、算法流程）
  - constraints: sequential, parallel, horizontal

network: 网络布局（关系图、依赖图、概念图）
  - constraints: group, center, hierarchy

data: 数据布局（图表、数据展示）
  - constraints: horizontal, vertical

====================
【约束类型详解】
====================

equalLength: 所有边长度相等
rightAngle: 直角关系
diagonalIntersect: 对角线相交于中点
parallel: 平行边
perpendicular: 垂直边
group: 分组排列
center: 中心节点
horizontal: 水平对齐
vertical: 垂直对齐
sequential: 顺序排列

====================
【强制规则】
====================

1. 只输出 JSON，不要解释，不要包含 markdown 代码块标记
2. 每个 step 必须有 text
3. 节点 ID 必须简洁（如 A, B, f, y, n1）
4. **必须指定节点坐标**：每个节点必须有 x 和 y 属性，代表在 SVG 中的位置
5. 步骤必须有清晰的教学顺序
6. 每一步只做一件事（不要同时添加太多节点）
7. **不要添加 layoutHints**：计算式 DSL 不需要布局提示
8. **不要添加冗余 style**：使用默认样式即可
9. domain 必须使用标准值：只能使用 mathematics | software_engineering | physics | general

====================
【画布尺寸】
====================

- 默认尺寸：800x500px
- 中心点：400, 250

====================
【annotation 规则】
====================

annotation 节点直接指定 x/y 坐标即可，target.nodeId 只用于语义关联。

**示例**：
{
  "id": "reliable",
  "label": "可靠",
  "type": "annotation",
  "x": 400,
  "y": 200,
  "target": { "nodeId": "tcp" }
}

====================
【设计原则】
====================

- 从简单到复杂
- 一步一步构建理解
- 每一步只引入一个新概念
- 图只是辅助理解

====================
【Few-shot 示例】
====================

示例 1：什么是函数？
{
  "title": "函数的基本概念",
  "meta": { "domain": "mathematics" },
  "nodes": [
    { "id": "x", "label": "输入 x", "type": "dataPoint", "x": 150, "y": 250 },
    { "id": "f", "label": "f()", "type": "concept", "x": 400, "y": 250 },
    { "id": "y", "label": "输出 y", "type": "dataPoint", "x": 650, "y": 250 }
  ],
  "edges": [
    { "from": "x", "to": "f", "label": "处理", "type": "arrow" },
    { "from": "f", "to": "y", "type": "arrow" }
  ],
  "steps": [
    { "text": "我们先看一个输入 x", "add": [{ "id": "x", "label": "输入 x", "type": "dataPoint", "x": 150, "y": 250 }] },
    { "text": "函数 f 会处理这个输入", "add": [{ "id": "f", "label": "f()", "type": "concept", "x": 400, "y": 250 }], "connect": [{ "from": "x", "to": "f", "label": "处理", "type": "arrow" }] },
    { "text": "处理后得到输出 y", "add": [{ "id": "y", "label": "输出 y", "type": "dataPoint", "x": 650, "y": 250 }], "connect": [{ "from": "f", "to": "y", "type": "arrow" }] },
    { "text": "这就是函数：输入 → 处理 → 输出", "highlight": ["f"] }
  ]
}


示例 3：什么是正方形？
{
  "title": "正方形的性质",
  "meta": { "domain": "mathematics" },
  "nodes": [
    { "id": "A", "label": "A", "type": "vertex", "x": 250, "y": 150 },
    { "id": "B", "label": "B", "type": "vertex", "x": 550, "y": 150 },
    { "id": "C", "label": "C", "type": "vertex", "x": 550, "y": 350 },
    { "id": "D", "label": "D", "type": "vertex", "x": 250, "y": 350 },
    { "id": "lengthAB", "label": "5cm", "type": "annotation", "x": 400, "y": 130, "target": { "nodeId": "A" } },
    { "id": "angleA", "label": "90°", "type": "annotation", "x": 230, "y": 150, "target": { "nodeId": "A" } },
    { "id": "angleB", "label": "90°", "type": "annotation", "x": 570, "y": 150, "target": { "nodeId": "B" } }
  ],
  "edges": [
    { "from": "A", "to": "B", "label": "边" },
    { "from": "B", "to": "C", "label": "边" },
    { "from": "C", "to": "D", "label": "边" },
    { "from": "D", "to": "A", "label": "边" },
    { "from": "A", "to": "C", "label": "对角线" },
    { "from": "B", "to": "D", "label": "对角线" }
  ],
  "steps": [
    { "text": "画四个顶点 A、B、C、D", "add": [
      { "id": "A", "label": "A", "type": "vertex", "x": 250, "y": 150 },
      { "id": "B", "label": "B", "type": "vertex", "x": 550, "y": 150 },
      { "id": "C", "label": "C", "type": "vertex", "x": 550, "y": 350 },
      { "id": "D", "label": "D", "type": "vertex", "x": 250, "y": 350 }
    ]},
    { "text": "依次连接各边", "connect": [
      { "from": "A", "to": "B", "label": "边" },
      { "from": "B", "to": "C", "label": "边" },
      { "from": "C", "to": "D", "label": "边" },
      { "from": "D", "to": "A", "label": "边" }
    ]},
    { "text": "标注一条边的长度", "add": [{ "id": "lengthAB", "label": "5cm", "type": "annotation", "x": 400, "y": 130 }] },
    { "text": "正方形的特点是四个角都是直角", "add": [
      { "id": "angleA", "label": "90°", "type": "annotation", "x": 230, "y": 150 },
      { "id": "angleB", "label": "90°", "type": "annotation", "x": 570, "y": 150 }
    ]},
    { "text": "两条对角线互相平分", "connect": [
      { "from": "A", "to": "C", "label": "对角线" },
      { "from": "B", "to": "D", "label": "对角线" }
    ]}
  ]
}

====================
【输出格式要求】
====================

1. 必须输出纯 JSON，不要包含 markdown 代码块标记
2. JSON 必须能被标准 JSON.parse 解析
3. 确保所有引号、转义字符正确
4. 节点和边可以预先定义，也可以在 steps 中动态添加
5. 优先使用 steps 中的 add/connect，保持步骤的渐进性`
            },
            ...chatHistory.map(msg => ({
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

      const data = await response.json();
      const responseContent = data.choices[0]?.message?.content || '';

      let parsedDsl: DSL | null = null;
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedDsl = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('JSON解析失败:', e);
      }

      const newAssistantMessage: ChatMessage = {
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now()
      };

      setChatHistory([...chatHistory, newUserMessage, newAssistantMessage]);

      if (parsedDsl) {
        setNodes(new Map());
        setEdges([]);
        setVisibleNodeIds(new Set());
        setVisibleEdgeIds(new Set());
        setHighlightedNodes(new Set());
        setHighlightedEdges(new Set());
        setCurrentStep(-1);
        setCurrentText('');
        setActiveTimelineEvents([]);
        setTimelineAnimations(new Map());
        
        setDsl(parsedDsl);
        playAllSteps(parsedDsl);
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
      setChatHistory([...chatHistory, newUserMessage, errorMessage]);
      setIsLoading(false);
      setLoadingStartTime(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIGenerate();
    }
  };

  const handleClear = () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (typingRef.current) {
      clearTimeout(typingRef.current);
      typingRef.current = null;
    }
    
    setNodes(new Map());
    setEdges([]);
    setVisibleNodeIds(new Set());
    setVisibleEdgeIds(new Set());
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setCurrentStep(-1);
    setCurrentText('');
    setDisplayText('');
    setDsl(null);
    setNodeAnimations(new Map());
    setActiveTimelineEvents([]);
    setTimelineAnimations(new Map());
  };

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
