from __future__ import annotations

import boto3

from app.core.settings import settings
from app.storage.base import Storage, StoredObject


class S3Storage(Storage):
    def __init__(self) -> None:
        if not settings.s3_bucket:
            raise RuntimeError("IMG3D_S3_BUCKET is required for storage_mode=s3")
        self.bucket = settings.s3_bucket
        self.prefix = settings.s3_prefix.lstrip("/")

        sess = boto3.session.Session(
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
            region_name=settings.s3_region or None,
        )
        self.client = sess.client("s3", endpoint_url=settings.s3_endpoint_url or None)

    def _key(self, object_key: str) -> str:
        k = object_key.lstrip("/")
        return f"{self.prefix}{k}" if self.prefix else k

    def put_bytes(self, *, object_key: str, data: bytes, content_type: str) -> StoredObject:
        key = self._key(object_key)
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        url = self.presigned_download_url(object_key=object_key)
        return StoredObject(object_key=object_key, size_bytes=len(data), public_url=url)

    def exists(self, *, object_key: str) -> bool:
        key = self._key(object_key)
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def open_local_path(self, *, object_key: str) -> str | None:
        return None

    def presigned_download_url(self, *, object_key: str) -> str:
        key = self._key(object_key)
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=int(settings.s3_presign_exp_seconds),
        )

