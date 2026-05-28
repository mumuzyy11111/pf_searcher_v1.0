"""全局配置管理"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


def _resolve_project_root() -> Path:
    """Resolve project root for source and bundled execution."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


PROJECT_ROOT = _resolve_project_root()
ENV_FILE = PROJECT_ROOT / ".env"
CONFIG_ENV_FILE = PROJECT_ROOT / "config" / "app.env"


DEFAULT_SOURCE_METADATA: dict[str, dict[str, object]] = {
    "AG": {
        "display_source": "AG",
        "title": "Adventurer's Guide",
        "aon_section": "Spells",
        "aon_count": 47,
    },
    "APG": {
        "display_source": "APG",
        "title": "Advanced Player's Guide",
        "aon_section": "Spells",
        "aon_count": 267,
    },
    "ISG": {
        "display_source": "ISG",
        "title": "Inner Sea Gods",
        "aon_section": "Spells",
        "aon_count": 65,
    },
    "ISI": {
        "display_source": "ISI",
        "title": "Inner Sea Intrigue",
        "aon_section": "Spells",
        "aon_count": 26,
    },
    "MA": {
        "display_source": "MA",
        "title": "Mythic Adventures",
        "aon_section": "Mythic Spells",
        "aon_count": 270,
    },
    "MC": {
        "display_source": "MC",
        "title": "Monster Codex",
        "aon_section": "Spells",
        "aon_count": 24,
    },
    "UW": {
        "display_source": "UW",
        "title": "Ultimate Wilderness",
        "aon_section": "Spells",
        "aon_count": 57,
    },
    "VC": {
        "display_source": "VC",
        "title": "Villain Codex",
        "aon_section": "Spells",
        "aon_count": 26,
    },
    "PA": {
        "display_source": "PA",
        "title": "Planar Adventures",
        "aon_section": "Spells",
        "aon_count": 23,
    },
    "PA_1": {
        "display_source": "PA",
        "title": "Psychic Anthology",
        "aon_section": "Spells",
        "aon_count": 16,
    },
}


def load_source_metadata() -> dict[str, dict[str, object]]:
    metadata = {code: values.copy() for code, values in DEFAULT_SOURCE_METADATA.items()}
    counts_path = PROJECT_ROOT / "data" / "aon_source_counts.json"
    if not counts_path.exists():
        return metadata

    try:
        with open(counts_path, "r", encoding="utf-8") as file:
            sources = json.load(file).get("sources", {})
    except Exception:
        return metadata

    for source_code, values in sources.items():
        if not isinstance(values, dict):
            continue
        source_metadata = metadata.setdefault(source_code.upper(), {})
        for key in ("display_source", "title", "aon_section", "aon_count"):
            if key in values:
                source_metadata[key] = values[key]
    return metadata


SOURCE_METADATA = load_source_metadata()


def discover_spell_sources() -> list[str]:
    """Discover spell JSON files under result/.

    Prefer normalized model files and fall back to legacy raw files when a
    source has not been normalized yet. The index directory is metadata, not a
    spell corpus, so it is intentionally excluded.
    """
    result_dir = PROJECT_ROOT / "result"
    if not result_dir.exists():
        return []

    sources: list[str] = []
    for source_dir in sorted(path for path in result_dir.iterdir() if path.is_dir()):
        code = source_dir.name
        if code.lower() == "index":
            continue

        raw_path = source_dir / f"spells-{code}.json"
        model_path = source_dir / f"spells-{code}-model.json"
        chosen = raw_path if raw_path.exists() else model_path
        if chosen.exists():
            sources.append(chosen.relative_to(PROJECT_ROOT).as_posix())
    return sources


class Settings(BaseSettings):
    """应用配置"""
    
    # 路径配置
    PROJECT_ROOT: Path = PROJECT_ROOT
    DATA_DIR: Path = PROJECT_ROOT / "data"
    RESULT_DIR: Path = PROJECT_ROOT / "result"
    
    # 数据源配置
    SPELL_SOURCES: list[str] = Field(default_factory=discover_spell_sources)
    
    # 索引配置
    CHROMA_PERSIST_DIR: str = "data/chroma_db"
    BM25_INDEX_PATH: str = "data/bm25_index/index.pkl"
    EMBEDDING_PROVIDER: str = "siliconflow"
    EMBEDDING_BASE_URL: str = "https://api.siliconflow.cn/v1"
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_MODEL: str = "BAAI/bge-large-zh-v1.5"
    EMBEDDING_BATCH_SIZE: int = 32
    EMBEDDING_MAX_CHARS: int = 400
    EMBEDDING_LOCAL_FILES_ONLY: bool = False
    
    # 检索配置
    BM25_TOP_K: int = 20
    VECTOR_TOP_K: int = 20
    FINAL_TOP_K: int = 20
    
    # LLM 配置
    LLM_PROVIDER: str = "siliconflow"
    LLM_MODEL: str = "deepseek-ai/DeepSeek-V3.2"
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.siliconflow.cn/v1"
    LLM_MAX_TOKENS: int = 2000
    LLM_TEMPERATURE: float = 0.1
    LLM_TIMEOUT: int = 120  # 秒
    
    # 服务配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    class Config:
        env_file = (ENV_FILE, CONFIG_ENV_FILE)
        env_file_encoding = "utf-8"
        case_sensitive = False


# 全局配置实例
settings = Settings()
