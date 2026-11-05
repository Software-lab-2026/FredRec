import hashlib
import logging
import math
import re
from functools import lru_cache
from typing import Protocol
from fastapi.concurrency import run_in_threadpool
from app.core.config import BACKEND_DIR, get_settings

DIMENSIONS = 384
log = logging.getLogger(__name__)


class Embedder(Protocol):
    def passages(self, texts: list[str]) -> list[list[float]]: ...
    def query(self, text: str) -> list[float]: ...


class FastEmbedder:
    def __init__(self, model: str):
        from fastembed import TextEmbedding

        self.model = TextEmbedding(model_name=model, cache_dir=str(
            BACKEND_DIR / ".cache" / "fastembed"))

    def passages(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self.model.passage_embed(texts)]

    def query(self, text: str) -> list[float]:
        return next(iter(self.model.query_embed([text]))).tolist()


class HashEmbedder:
    def passages(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def query(self, text: str) -> list[float]:
        return self._embed(text)

    def _embed(self, text: str) -> list[float]:
        vector = [0.0] * DIMENSIONS
        for word in re.findall(r"[a-z0-9+#]+", text.lower()):
            digest = hashlib.sha256(word.encode()).digest()
            vector[int.from_bytes(digest[:2], "big") %
                   DIMENSIONS] += 1.0 if digest[2] % 2 else -1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]


@lru_cache
def get_embedder() -> Embedder:
    model = get_settings().embedding_model
    return HashEmbedder() if model == "hash" else FastEmbedder(model)


async def embed_passages(texts: list[str]) -> list[list[float]] | None:
    try:
        return await run_in_threadpool(get_embedder().passages, texts)
    except Exception:
        log.exception(
            "Embedding failed; meaning-based search is unavailable until it works again")
        return None


async def embed_query(text: str) -> list[float] | None:
    try:
        return await run_in_threadpool(get_embedder().query, text)
    except Exception:
        log.exception(
            "Embedding failed; meaning-based search is unavailable until it works again")
        return None
