"""Local file storage adapter for document uploads."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED_EXT = {
    "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx",
    "png", "jpg", "jpeg", "gif", "webp", "zip", "txt",
}
MAX_MB = 25


def validate_upload(filename: str, size_bytes: int) -> str | None:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        return f"Type de fichier non autorisé (.{ext})."
    if size_bytes > MAX_MB * 1024 * 1024:
        return f"Fichier trop volumineux (max {MAX_MB} Mo)."
    return None


def save_upload(entity_type: str, entity_id: str, filename: str, data: bytes) -> str:
    """Write bytes under uploads/<entity_type>/<entity_id>/ and return the key."""
    key = f"{entity_type}/{entity_id}/{uuid4().hex}__{filename}"
    path = UPLOAD_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def read_file(key: str) -> bytes | None:
    path = UPLOAD_DIR / key
    if path.exists():
        return path.read_bytes()
    return None


def delete_file(key: str) -> None:
    path = UPLOAD_DIR / key
    if path.exists():
        path.unlink()
