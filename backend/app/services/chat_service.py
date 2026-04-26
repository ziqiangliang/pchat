import json
import httpx
from typing import AsyncGenerator, List
from app.config import settings
from app.schemas.chat import ChatMessage

DSL_SYSTEM_PROMPT = """系统支持两层画布，可以独立或同时使用：
- 节点层：概念框、流程框、文字标注（像素坐标 0~800, 0~500）
- 数学层：坐标系上的点、线、曲线（数学坐标，Y向上为正）

DSL 结构：
{
  "title": "标题",
  "meta": { "domain": "领域标签" },
  "layoutHints": { "type": "布局类型" },
  "mathCanvas": {                    // 可选，涉及坐标系时使用
    "rangeX": [-6, 6],
    "rangeY": [-5, 5],
    "showGrid": true
  },
  "steps": [
    {
      "text": "讲解文字",
      "showCoord": true,             // 让坐标系出现（一般第一步）
      "math": {                      // 数学层操作（数学坐标）
        "addPoints": [{ "id": "A", "label": "A(2,5)", "x": 2, "y": 5 }],
        "addLines": [{ "from": "A", "to": "B", "label": "y=3x-1", "extend": true }],
        "addCurves": [{ "id": "c1", "fn": "x*x", "range": [-3,3], "label": "y=x²" }],
        "removePoints": ["ID"],
        "removeLines": ["ID"],
        "highlight": ["ID"]
      },
      "add": [{ "id": "节点ID", "label": "文字", "type": "节点类型", "x": x, "y": y }],
      "connect": [{ "from": "ID", "to": "ID", "label": "标签", "type": "边类型" }],
      "remove": ["节点ID"],
      "highlight": ["节点ID"]
    }
  ]
}

节点类型：vertex(绿色圆形), concept(浅灰矩形), dataPoint(蓝色圆形), annotation(黄色矩形), process(橙色矩形)
边类型：straight(直线,无箭头), arrow(箭头), curve(曲线), diagonal(对角线)
布局类型：geometry(几何), flow(流程), network(网络), data(数据)
领域标签：mathematics(数学), software_engineering(软件工程), physics(物理), general(通用)

强制规则：
1. 只输出 JSON，不要解释，不要包含 markdown 代码块标记
2. 每个 step 必须有 text
3. 节点 ID 必须简洁
4. 节点层的 x/y 用像素坐标（画布 800×500），数学层的 x/y 用数学坐标
5. 步骤必须有清晰的教学顺序，像老师讲课一样一步一步来
6. 所有节点都在 steps 的 add 中逐步添加，所有边都在 connect 中逐步添加
7. 节点或线的 label 里推荐用 emoji 表情符号来增强可视化，播报文字不需要
8. 每一步尽量简单只出现一到两个概念，且必须有动作
9. 尽量保证图上干净不重叠，中间节点可以通过 remove 操作删掉
10. 可以通过点和线可以画任意形状
11. 【函数/坐标系题目】必须使用 mathCanvas + math 操作：
    - 第一步加 "showCoord": true 画出坐标系
    - 用 math.addPoints 标点（数学坐标），用 math.addLines 画线段/直线
    - 说明性文字框（方程式、推导）用节点层 add（像素坐标，放在画布右侧如 x:620~780）
    - 直线用 "extend": true 延伸到坐标系边界
    - addCurves 可画函数曲线：fn 是 JS 表达式，如 "x*x"、"Math.sin(x)"
    - 根据数据范围设 rangeX/rangeY，确保所有点在范围内且留余量
12. 【非坐标系题目】不需要 mathCanvas，只用节点层 add/connect 即可"""


async def stream_chat(messages: List[ChatMessage]) -> AsyncGenerator[str, None]:
    url = f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions"
    
    formatted_messages = [{"role": msg.role, "content": msg.content} for msg in messages]
    
    formatted_messages.insert(0, {
        "role": "system",
        "content": DSL_SYSTEM_PROMPT
    })
    
    request_body = {
        "model": settings.LLM_MODEL,
        "stream": True,
        "messages": formatted_messages
    }
    request_body["thinking"] = {"type": "disabled"}
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.LLM_API_KEY}"
            },
            json=request_body
        ) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                raise Exception(f"LLM API error: {response.status_code} - {error_body.decode()}")
            
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue
