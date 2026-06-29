#!/usr/bin/env python3
"""Start the lightweight PF browser runtime."""
from __future__ import annotations

import os

import uvicorn

from pf_rag.runtime.lite_app import create_lite_app
from pf_rag.runtime.paths import RuntimePaths
from pf_rag.runtime.server import find_free_port, open_browser
from pf_rag.version import APP_RELEASE_NAME


PATHS = RuntimePaths.from_entry_file(__file__)
app = create_lite_app(PATHS)


def main() -> None:
    os.chdir(PATHS.base_dir)
    port = find_free_port(8000)
    url = f"http://localhost:{port}/web/"

    print("=" * 60)
    print(f"{APP_RELEASE_NAME} Lite")
    print("=" * 60)
    print(f"Local app: {url}")
    print(f"API docs:  http://localhost:{port}/docs")
    print("Press Ctrl+C to stop.")
    print("=" * 60)

    open_browser(url)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
