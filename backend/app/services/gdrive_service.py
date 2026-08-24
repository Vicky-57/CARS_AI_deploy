"""
app/services/gdrive_service.py
────────────────────────────────────────────────────────────────────────
Google Drive Integration Service — 3-Tier Customer Folder Hierarchy

Folder Structure:
  My Drive / CAR-AGENTS / {Customer Name} - #{Project ID} /
    ├── 1. OCR          (Raw vehicle document scans & spec intake)
    ├── 2. Legal Docs   (CAR-AGENTS GTC, Power of Attorney, disclaimers)
    └── 3. Signed Docs  (Final executed & digitally signed PDF contracts)

Responsibilities:
  - create_customer_folder_structure() → Creates customer folder + 3 subfolders
  - upload_document_to_folder()       → Uploads a file to a specific subfolder (OCR, Legal, Signed)
  - upload_approved_contract_to_drive() → Direct contract upload to "3. Signed Docs"
────────────────────────────────────────────────────────────────────────
"""
import os
import json
import logging
import urllib.request
import urllib.parse
from typing import Dict, Optional

from app.services.google_service import _get_valid_access_token

logger = logging.getLogger("gdrive_service")

DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"

ROOT_FOLDER_NAME = "CAR-AGENTS"
SUBFOLDER_NAMES = ["1. OCR", "2. Legal Docs", "3. Signed Docs"]


def _drive_request(method: str, path: str, body: dict = None, is_upload_api: bool = False) -> dict:
    """Authenticated request to Google Drive REST API v3."""
    token = _get_valid_access_token()
    if not token:
        raise PermissionError("Google Drive not connected. Please authorize via Settings → App Connections.")
    base = DRIVE_UPLOAD_API if is_upload_api else DRIVE_API
    url = f"{base}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8")) if r.length != 0 else {}


def _find_or_create_folder(name: str, parent_id: str = None) -> str:
    """Find a Drive folder by name (and optional parent), or create it if missing."""
    token = _get_valid_access_token()
    if not token:
        raise PermissionError("Google Drive not connected.")

    q = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        q += f" and '{parent_id}' in parents"
    url = f"{DRIVE_API}/files?q={urllib.parse.quote(q)}&fields=files(id,name)&spaces=drive"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as r:
        results = json.loads(r.read().decode("utf-8"))
    files = results.get("files", [])
    if files:
        return files[0]["id"]

    # Create the folder
    body = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_id:
        body["parents"] = [parent_id]
    created = _drive_request("POST", "/files", body)
    return created["id"]


def _get_or_create_root_folder() -> str:
    """Get or create the root 'CAR-AGENTS' folder in My Drive."""
    return _find_or_create_folder(ROOT_FOLDER_NAME)


def create_customer_folder_structure(customer_name: str, project_id: str) -> Dict[str, str]:
    """
    Creates the standardized 3-tier folder hierarchy for a project:
      My Drive / CAR-AGENTS / {Customer Name} - #{Project ID} /
        ├── 1. OCR
        ├── 2. Legal Docs
        └── 3. Signed Docs
    Returns dictionary with all folder IDs and shareable URLs.
    """
    clean_name = "".join(c for c in customer_name if c.isalnum() or c in (" ", "_", "-")).strip() or "Client"
    folder_name = f"{clean_name} - #{project_id[:8]}"

    root_id = _get_or_create_root_folder()
    customer_folder_id = _find_or_create_folder(folder_name, parent_id=root_id)

    subfolder_ids = {}
    for sub in SUBFOLDER_NAMES:
        sub_id = _find_or_create_folder(sub, parent_id=customer_folder_id)
        subfolder_ids[sub] = sub_id

    logger.info(f"Created 3-tier Drive structure for {folder_name}")

    return {
        "root_folder_id": root_id,
        "customer_folder_id": customer_folder_id,
        "customer_folder_name": folder_name,
        "ocr_folder_id": subfolder_ids["1. OCR"],
        "legal_docs_folder_id": subfolder_ids["2. Legal Docs"],
        "signed_docs_folder_id": subfolder_ids["3. Signed Docs"],
        "folder_path": f"My Drive / {ROOT_FOLDER_NAME} / {folder_name}",
    }


def upload_file_to_drive_folder(
    parent_folder_id: str,
    filename: str,
    file_bytes: bytes,
    mime_type: str = "application/pdf"
) -> Dict:
    """Upload raw bytes to a specific Google Drive folder."""
    token = _get_valid_access_token()
    if not token:
        raise PermissionError("Google Drive not connected.")

    boundary = "car_agents_upload_boundary_987"
    metadata = json.dumps({
        "name": filename,
        "parents": [parent_folder_id]
    }).encode("utf-8")

    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
    ).encode("utf-8") + metadata + (
        f"\r\n--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--".encode("utf-8")

    url = f"{DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink,name"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        uploaded = json.loads(r.read().decode("utf-8"))

    return {
        "file_id": uploaded.get("id"),
        "filename": filename,
        "webViewLink": uploaded.get("webViewLink"),
    }


async def upload_approved_contract_to_drive(
    customer_name: str,
    contract_filename: str,
    pdf_file_path: str,
    project_id: str = "general",
    target_subfolder: str = "3. Signed Docs"
) -> dict:
    """
    Uploads a signed/approved contract to the customer's '3. Signed Docs' folder.
    """
    if not os.path.exists(pdf_file_path):
        return {"success": False, "error": f"File not found: {pdf_file_path}"}

    try:
        structure = create_customer_folder_structure(customer_name, project_id)
        target_folder_id = structure["signed_docs_folder_id"] if target_subfolder == "3. Signed Docs" else structure["ocr_folder_id"]

        with open(pdf_file_path, "rb") as f:
            pdf_bytes = f.read()

        result = upload_file_to_drive_folder(
            parent_folder_id=target_folder_id,
            filename=contract_filename,
            file_bytes=pdf_bytes,
            mime_type="application/pdf"
        )

        return {
            "success": True,
            "filename": contract_filename,
            "drive_file_id": result.get("file_id"),
            "drive_url": result.get("webViewLink"),
            "folder_path": f"{structure['folder_path']} / {target_subfolder}",
        }
    except Exception as e:
        logger.error(f"Google Drive upload error: {e}")
        return {"success": False, "error": str(e)}
