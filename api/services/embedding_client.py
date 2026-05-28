"""Embedding client abstraction."""
from __future__ import annotations

from typing import List, Sequence

import numpy as np
from openai import OpenAI

from api.config import settings


class EmbeddingClient:
    """Small adapter for local sentence-transformers or OpenAI-compatible APIs."""

    def __init__(self):
        self.provider = settings.EMBEDDING_PROVIDER.lower().strip()
        self.model_name = settings.EMBEDDING_MODEL
        self.batch_size = settings.EMBEDDING_BATCH_SIZE
        self._client = None
        self._local_model = None

        if self.provider in {"siliconflow", "openai", "api"}:
            api_key = settings.EMBEDDING_API_KEY or settings.LLM_API_KEY
            if not api_key:
                raise ValueError("EMBEDDING_API_KEY or LLM_API_KEY is required for API embeddings")
            self._client = OpenAI(
                api_key=api_key,
                base_url=settings.EMBEDDING_BASE_URL or settings.LLM_BASE_URL,
            )
        elif self.provider in {"local", "huggingface", "sentence-transformers"}:
            from sentence_transformers import SentenceTransformer

            self._local_model = SentenceTransformer(
                self.model_name,
                local_files_only=settings.EMBEDDING_LOCAL_FILES_ONLY,
            )
        else:
            raise ValueError(f"Unsupported EMBEDDING_PROVIDER: {settings.EMBEDDING_PROVIDER}")

    def encode(self, texts: Sequence[str], show_progress_bar: bool = False) -> np.ndarray:
        if isinstance(texts, str):
            texts = [texts]
        texts = list(texts)

        if self._local_model is not None:
            return np.asarray(
                self._local_model.encode(texts, show_progress_bar=show_progress_bar),
                dtype=np.float32,
            )

        vectors: List[List[float]] = []
        total = len(texts)
        for start in range(0, total, self.batch_size):
            batch = [
                text[: settings.EMBEDDING_MAX_CHARS]
                for text in texts[start : start + self.batch_size]
            ]
            response = self._client.embeddings.create(
                model=self.model_name,
                input=batch,
            )
            batch_vectors = [item.embedding for item in response.data]
            vectors.extend(batch_vectors)
            if show_progress_bar:
                done = min(start + len(batch), total)
                print(f"Embedding progress: {done}/{total}")

        return np.asarray(vectors, dtype=np.float32)


def create_embedding_client() -> EmbeddingClient:
    return EmbeddingClient()
