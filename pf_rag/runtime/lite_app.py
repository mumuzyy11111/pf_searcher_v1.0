from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from pf_rag.runtime.paths import RuntimePaths
from pf_rag.runtime.spell_catalog import SpellCatalog
from pf_rag.version import APP_NAME, APP_VERSION


def create_lite_app(paths: RuntimePaths) -> FastAPI:
    catalog = SpellCatalog(paths)
    app = FastAPI(
        title=f"{APP_NAME} Lite API",
        description="Local Pathfinder tools browser without RAG/indexing dependencies.",
        version=APP_VERSION,
    )

    @app.get("/api/health")
    async def health():
        return {
            "status": "lite",
            "version": APP_VERSION,
            "spell_count": catalog.spell_count(),
            "index_built_at": None,
        }

    @app.get("/api/spell-sources")
    async def spell_sources():
        return JSONResponse({"sources": catalog.source_summaries()})

    @app.get("/api/spells/keyword")
    async def keyword_search(
        q: str = Query(..., min_length=1, description="keyword query"),
        limit: int = Query(500, ge=1, le=5000, description="max returned spells"),
    ):
        return JSONResponse(catalog.keyword_search(q, limit))

    if paths.web_dir.exists():
        app.mount("/web", StaticFiles(directory=str(paths.web_dir), html=True), name="web")
    if paths.result_dir.exists():
        app.mount("/result", StaticFiles(directory=str(paths.result_dir)), name="result")

    return app
