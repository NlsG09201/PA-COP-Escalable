from __future__ import annotations

from app.core.settings import settings
from app.storage.base import Storage
from app.storage.local import LocalStorage
from app.storage.s3 import S3Storage


def create_storage() -> Storage:
    mode = settings.storage_mode.lower().strip()
    if mode == "local":
        return LocalStorage()
    if mode == "s3":
        return S3Storage()
    raise RuntimeError(f"Unsupported IMG3D_STORAGE_MODE={settings.storage_mode!r}")

