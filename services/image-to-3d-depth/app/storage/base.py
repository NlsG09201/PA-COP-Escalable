from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredObject:
    object_key: str
    size_bytes: int
    public_url: str


class Storage(ABC):
    @abstractmethod
    def put_bytes(self, *, object_key: str, data: bytes, content_type: str) -> StoredObject:
        raise NotImplementedError

    @abstractmethod
    def exists(self, *, object_key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def open_local_path(self, *, object_key: str) -> str | None:
        """If storage is local, return filesystem path; else None."""
        raise NotImplementedError

    @abstractmethod
    def presigned_download_url(self, *, object_key: str) -> str:
        raise NotImplementedError

