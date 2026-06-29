#!/usr/bin/env python3
"""Start the full pathfinder_tools web application."""
from __future__ import annotations

import os

import uvicorn
from fastapi.staticfiles import StaticFiles

from api.main import app
from pf_rag.runtime.paths import RuntimePaths
from pf_rag.runtime.server import find_free_port, open_browser
from pf_rag.version import APP_RELEASE_NAME


PATHS = RuntimePaths.from_entry_file(__file__)


def mount_runtime_assets() -> None:
    if PATHS.web_dir.exists():
        app.mount("/web", StaticFiles(directory=str(PATHS.web_dir), html=True), name="web")
    if PATHS.result_dir.exists():
        app.mount("/result", StaticFiles(directory=str(PATHS.result_dir)), name="result")


def main() -> None:
    os.chdir(PATHS.base_dir)
    mount_runtime_assets()
    port = find_free_port(8000)
    url = f"http://localhost:{port}/web/"

    print("=" * 60)
    print(APP_RELEASE_NAME)
    print("=" * 60)
    print(f"Local app: {url}")
    print(f"API docs:  http://localhost:{port}/docs")
    print("Press Ctrl+C to stop.")
    print("=" * 60)

    open_browser(url)

    try:
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
