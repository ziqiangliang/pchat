#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$SCRIPT_DIR/venv"

if [ ! -d "$VENV_PATH" ]; then
    echo "错误：虚拟环境不存在: $VENV_PATH"
    echo "请先运行: python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

cd "$SCRIPT_DIR" || exit 1
source "$VENV_PATH/bin/activate"

echo "正在启动 uvicorn 服务..."
echo "访问地址: http://0.0.0.0:8000"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
