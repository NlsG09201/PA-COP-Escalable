from __future__ import annotations

import os
from pathlib import Path

from app.core.settings import settings
from app.storage.base import Storage, StoredObject


class LocalStorage(Storage):
    def __init__(self) -> None:
        self.root = Path(settings.local_storage_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, object_key: str) -> Path:
        safe = object_key.lstrip("/").replace("..", "_")
        return self.root / safe

    def put_bytes(self, *, object_key: str, data: bytes, content_type: str) -> StoredObject:
        p = self._path_for(object_key)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, p)

        base = settings.public_base_url.rstrip("/")
        if base:
            url = f"{base}/models/{object_key}"
        else:
            url = f"/models/{object_key}"
        return StoredObject(object_key=object_key, size_bytes=len(data), public_url=url)

    def exists(self, *, object_key: str) -> bool:
        return self._path_for(object_key).exists()

    def open_local_path(self, *, object_key: str) -> str | None:
        p = self._path_for(object_key)
        return str(p) if p.exists() else None

    def presigned_download_url(self, *, object_key: str) -> str:
        # For local, API serves the file directly; this acts as a stable URL.
        base = settings.public_base_url.rstrip("/")
        if base:
            return f"{base}/models/{object_key}/download"
        return f"/models/{object_key}/download"

