#!/usr/bin/env python3
"""启动 FastAPI 服务器并自动打开法术查询页面。

使用：
    python run_web.py

注意：
    - 默认监听 8000 端口，根目录为当前文件所在仓库根目录。
    - 同时提供静态文件服务（web/ 和 result/）和 API 服务（/api/*）。
    - 前端请求的 JSON 路径假设为 ../result/spells-*.json。
"""
from __future__ import annotations

import contextlib
import socket
import sys
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.main import app


def find_free_port(preferred: int = 8000) -> int:
    """找到可用端口，优先使用 preferred。"""
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("", preferred))
            return preferred
        except OSError:
            sock.bind(("", 0))
            return sock.getsockname()[1]


def resolve_base_dir() -> Path:
    """获取静态资源根目录。

    - 普通运行：使用脚本所在目录。
    - PyInstaller 打包：使用 exe 所在目录。
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).parent.resolve()


def main() -> None:
    base_dir = resolve_base_dir()
    
    # 切换到项目根目录
    import os
    os.chdir(base_dir)
    
    # 挂载静态文件
    web_dir = base_dir / "web"
    result_dir = base_dir / "result"
    
    if web_dir.exists():
        app.mount("/web", StaticFiles(directory=str(web_dir), html=True), name="web")
    if result_dir.exists():
        app.mount("/result", StaticFiles(directory=str(result_dir)), name="result")
    
    # 找到可用端口
    port = find_free_port(8000)
    
    # 构建 URL
    url = f"http://localhost:{port}/web/"
    
    print("=" * 60)
    print("PF 法术 RAG 系统")
    print("=" * 60)
    print(f"本地服务器已启动: {url}")
    print(f"API 文档: http://localhost:{port}/docs")
    print("按 Ctrl+C 停止。")
    print("=" * 60)
    
    # 自动打开浏览器
    with contextlib.suppress(Exception):
        webbrowser.open(url)
    
    # 启动 uvicorn 服务器
    try:
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=port,
            log_level="info",
        )
    except KeyboardInterrupt:
        print("\n收到退出信号，正在关闭服务器...")


if __name__ == "__main__":
    main()
