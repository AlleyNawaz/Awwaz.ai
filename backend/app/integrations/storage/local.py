import os
import hashlib
import uuid
from pathlib import Path
from typing import Dict, Any
from app.core.config import settings
from app.core.errors import ValidationException


ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class LocalStorageService:
    @staticmethod
    def save_evidence_file(
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> Dict[str, Any]:
        """Validate and securely persist uploaded evidence files."""
        # 1. MIME Validation
        if content_type not in ALLOWED_MIME_TYPES:
            raise ValidationException(
                f"Unsupported file type '{content_type}'. Allowed types: JPG, PNG, WebP."
            )

        # 2. Size Validation
        size_bytes = len(file_bytes)
        if size_bytes > settings.MAX_FILE_SIZE_BYTES:
            raise ValidationException(
                f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_BYTES // (1024*1024)} MB."
            )

        # 3. Hash computation
        sha256 = hashlib.sha256(file_bytes).hexdigest()

        # 4. Server-generated storage key
        ext = ALLOWED_MIME_TYPES[content_type]
        storage_key = f"{uuid.uuid4().hex}{ext}"

        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / storage_key

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        return {
            "storage_key": storage_key,
            "filename": filename,
            "mime_type": content_type,
            "size_bytes": size_bytes,
            "sha256": sha256,
        }
