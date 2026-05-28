"""FastAPI 主应用和路由定义"""
from __future__ import annotations

import time
import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from api.config import SOURCE_METADATA, settings
from api.models import (
    HealthResponse,
    RagAskRequest,
    RagAskResponse,
    RagSearchRequest,
    RagSearchResponse,
)
from api.services.retriever import HybridRetriever
from api.services.generator import LLMGenerator

app = FastAPI(
    title="PF 法术 RAG API",
    description="Pathfinder 法术检索增强生成系统",
    version="1.0.0",
)

# 全局检索器和生成器实例（延迟加载）
_retriever: HybridRetriever | None = None
_generator: LLMGenerator | None = None
_index_built_at: str | None = None
_spell_count: int = 0


def _count_spell_file(source_path: str) -> int | None:
    full_path = settings.PROJECT_ROOT / source_path
    try:
        with open(full_path, "r", encoding="utf-8") as file:
            data = json.load(file)
    except Exception:
        return None
    return len(data) if isinstance(data, list) else None


def _normalize_text(value: str) -> str:
    return " ".join(str(value).split()).strip().lower()


def _spell_matches_keyword(spell: dict, normalized_query: str) -> bool:
    if not normalized_query:
        return True
    text = _normalize_text(json.dumps(spell, ensure_ascii=False))
    return normalized_query in text


def get_retriever() -> HybridRetriever:
    """获取检索器实例（单例）"""
    global _retriever, _index_built_at, _spell_count
    
    if _retriever is None:
        try:
            _retriever = HybridRetriever()
            # 触发加载以验证索引存在
            _retriever._ensure_loaded()
            
            # 获取索引构建时间（从 Chroma 元数据或文件修改时间）
            chroma_dir = settings.PROJECT_ROOT / settings.CHROMA_PERSIST_DIR
            if chroma_dir.exists():
                # 使用目录修改时间作为近似值
                mtime = Path(chroma_dir).stat().st_mtime
                _index_built_at = datetime.fromtimestamp(mtime).isoformat()
            
            # 获取法术数量
            if _retriever._spells_dict:
                _spell_count = len(_retriever._spells_dict)
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"索引加载失败: {str(e)}。请先运行 python scripts/build_index.py"
            )
    
    return _retriever


def get_generator() -> LLMGenerator:
    """获取生成器实例（单例）"""
    global _generator
    
    if _generator is None:
        _generator = LLMGenerator()
    
    return _generator


@app.get("/api/health", response_model=HealthResponse)
async def health():
    """健康检查端点"""
    try:
        retriever = get_retriever()
        return HealthResponse(
            status="ok",
            version="1.0.0",
            spell_count=_spell_count,
            index_built_at=_index_built_at,
        )
    except Exception as e:
        return HealthResponse(
            status="error",
            version="1.0.0",
            spell_count=0,
            index_built_at=None,
        )


@app.get("/api/spell-sources")
async def spell_sources():
    """返回前端可加载的法术数据源列表。"""
    sources = []
    for source_path in settings.SPELL_SOURCES:
        source_code = Path(source_path).parent.name.upper()
        metadata = SOURCE_METADATA.get(source_code, {})
        sources.append({
            "source": source_code,
            "display_source": metadata.get("display_source", source_code),
            "title": metadata.get("title", ""),
            "aon_section": metadata.get("aon_section", ""),
            "aon_count": metadata.get("aon_count"),
            "indexed_count": _count_spell_file(source_path),
            "path": "/" + source_path.replace("\\", "/"),
        })
    return JSONResponse({"sources": sources})


@app.get("/api/spells/keyword")
async def keyword_search(
    q: str = Query(..., min_length=1, description="keyword query"),
    limit: int = Query(500, ge=1, le=5000, description="max returned spells"),
):
    """Search spells by keyword across every JSON field."""
    normalized_query = _normalize_text(q)
    matches: list[dict] = []
    total = 0

    for source_path in settings.SPELL_SOURCES:
        full_path = settings.PROJECT_ROOT / source_path
        source_code = Path(source_path).parent.name.upper()
        try:
            with open(full_path, "r", encoding="utf-8") as file:
                data = json.load(file)
        except Exception:
            continue
        if not isinstance(data, list):
            continue

        for spell in data:
            if not isinstance(spell, dict):
                continue
            if not _spell_matches_keyword(spell, normalized_query):
                continue
            total += 1
            if len(matches) < limit:
                enriched = dict(spell)
                if not enriched.get("来源"):
                    enriched["来源"] = source_code
                if not enriched.get("source_book"):
                    enriched["source_book"] = source_code
                matches.append(enriched)

    return JSONResponse(
        {
            "query": q,
            "total": total,
            "returned": len(matches),
            "limit": limit,
            "hits": matches,
        }
    )


@app.post("/api/rag/search", response_model=RagSearchResponse)
async def rag_search(request: RagSearchRequest):
    """RAG 检索端点（仅检索，不生成）"""
    start_time = time.time()
    
    try:
        retriever = get_retriever()
        results = retriever.search(
            question=request.question,
            top_k=request.top_k,
            filters=request.filters,
        )
        
        # 转换为响应格式
        hits = []
        for result in results:
            spell = result["spell_record"]
            hits.append({
                "spell_id": spell.spell_id,
                "name": spell.name,
                "source": spell.source,
                "spell_type": spell.spell_type,
                "school": spell.school,
                "level_raw": spell.level_raw,
                "score": result["score"],
                "snippet": result["context_text"][:200] + "..." if len(result["context_text"]) > 200 else result["context_text"],
            })
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return RagSearchResponse(
            hits=hits,
            total=len(hits),
            latency_ms=latency_ms,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/ask", response_model=RagAskResponse)
async def rag_ask(request: RagAskRequest):
    """RAG 问答端点（检索 + LLM 生成）"""
    start_time = time.time()
    request_api_key = (request.api_key or "").strip()
    if not request_api_key:
        raise HTTPException(status_code=400, detail="API key is required for smart search")
    
    try:
        retriever = get_retriever()
        generator = get_generator()
        
        # 检索
        results = retriever.search(
            question=request.question,
            top_k=request.top_k,
            filters=request.filters,
        )
        
        # 生成回答
        answer, citations, degraded, llm_error = await generator.generate_answer(
            question=request.question,
            context_chunks=results,
            api_key=request_api_key,
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return RagAskResponse(
            answer=answer,
            citations=[c.dict() for c in citations],
            retrieved_count=len(results),
            latency_ms=latency_ms,
            degraded=degraded,
            llm_error=llm_error,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
