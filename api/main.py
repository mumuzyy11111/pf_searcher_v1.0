"""FastAPI application assembly."""
from __future__ import annotations

from fastapi import FastAPI

from api.routers import health, rag, spells
from pf_rag.version import APP_NAME, APP_VERSION


app = FastAPI(
    title=f"{APP_NAME} API",
    description="Pathfinder tools search and retrieval-augmented Q&A API.",
    version=APP_VERSION,
)

app.include_router(health.router)
app.include_router(spells.router)
app.include_router(rag.router)
