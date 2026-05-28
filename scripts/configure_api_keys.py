#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "app.env"

DEFAULT_VALUES = {
    "LLM_PROVIDER": "siliconflow",
    "LLM_BASE_URL": "https://api.siliconflow.cn/v1",
    "LLM_MODEL": "deepseek-ai/DeepSeek-V3.2",
    "LLM_API_KEY": "",
    "LLM_TIMEOUT": "120",
    "LLM_MAX_TOKENS": "2000",
    "LLM_TEMPERATURE": "0.1",
    "EMBEDDING_PROVIDER": "siliconflow",
    "EMBEDDING_BASE_URL": "https://api.siliconflow.cn/v1",
    "EMBEDDING_API_KEY": "",
    "EMBEDDING_MODEL": "BAAI/bge-large-zh-v1.5",
    "EMBEDDING_BATCH_SIZE": "32",
    "EMBEDDING_MAX_CHARS": "400",
    "EMBEDDING_LOCAL_FILES_ONLY": "false",
    "BM25_TOP_K": "20",
    "VECTOR_TOP_K": "20",
    "FINAL_TOP_K": "20",
    "HOST": "0.0.0.0",
    "PORT": "8000",
}


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def quote_env_value(value: str) -> str:
    if value == "":
        return ""
    if re.search(r"\s|#|=", value):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value


def prompt_value(label: str, current: str = "", secret: bool = False) -> str:
    suffix = " [keep existing]" if current else ""
    prompt = f"{label}{suffix}: "
    entered = getpass.getpass(prompt) if secret else input(prompt)
    entered = entered.strip()
    return current if not entered else entered


def write_config(path: Path, values: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered_keys = list(DEFAULT_VALUES)
    extra_keys = [key for key in values if key not in DEFAULT_VALUES]

    lines = [
        "# Local PFSpellRAG configuration.",
        "# This file may contain API keys and must not be committed.",
        "",
    ]
    for key in ordered_keys + sorted(extra_keys):
        lines.append(f"{key}={quote_env_value(values.get(key, ''))}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Write local PFSpellRAG API settings to config/app.env."
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--llm-api-key", default="")
    parser.add_argument("--embedding-api-key", default="")
    parser.add_argument("--llm-base-url", default="")
    parser.add_argument("--embedding-base-url", default="")
    parser.add_argument("--llm-model", default="")
    parser.add_argument("--embedding-model", default="")
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Only use command-line values and existing config values.",
    )
    args = parser.parse_args()

    values = DEFAULT_VALUES.copy()
    values.update(parse_env(args.config))

    cli_updates = {
        "LLM_API_KEY": args.llm_api_key,
        "EMBEDDING_API_KEY": args.embedding_api_key,
        "LLM_BASE_URL": args.llm_base_url,
        "EMBEDDING_BASE_URL": args.embedding_base_url,
        "LLM_MODEL": args.llm_model,
        "EMBEDDING_MODEL": args.embedding_model,
    }
    for key, value in cli_updates.items():
        if value:
            values[key] = value.strip()

    if not args.non_interactive:
        print(f"Writing local config: {args.config}")
        values["LLM_BASE_URL"] = prompt_value("LLM base URL", values["LLM_BASE_URL"])
        values["LLM_MODEL"] = prompt_value("LLM model", values["LLM_MODEL"])
        values["LLM_API_KEY"] = prompt_value(
            "LLM API key", values["LLM_API_KEY"], secret=True
        )
        values["EMBEDDING_BASE_URL"] = prompt_value(
            "Embedding base URL", values["EMBEDDING_BASE_URL"]
        )
        values["EMBEDDING_MODEL"] = prompt_value(
            "Embedding model", values["EMBEDDING_MODEL"]
        )
        values["EMBEDDING_API_KEY"] = prompt_value(
            "Embedding API key", values["EMBEDDING_API_KEY"], secret=True
        )

    write_config(args.config, values)
    print(f"Config written: {args.config}")
    print("Restart the service for the new settings to take effect.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
