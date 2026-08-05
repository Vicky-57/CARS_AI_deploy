"""
app/services/gdrive_service.py
────────────────────────────────────────────────────────────────────────
Google Drive Integration Service — uses OAuth tokens from Supabase google_auth.

Auto-creates folder structure:
  My Drive / CAR-AGENTS Contracts / buy|sell / {Customer Name} / {contract.pdf}

Flow:
  1. Contract generated and previewed in UI.
  2. Client/Broker explicitly approves template accuracy.
  3. PDF uploaded to Google Drive in structured customer folder.
  4. Returns Drive File URL.
────────────────────────────────────────────────────────────────────────
"""
import os
import json
import logging
import urllib.request
import urllib.parse

from app.services.google_service import _get_valid_access_token
from database import get_supabase

logger = logging.getLogger("gdrive_service")

DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"

# Supabase key to cache the root folder ID
ROOT_FOLDER_NAME = "CAR-AGENTS Contracts"
FOLDER_ID_CACHE_KEY = "drive_root_folder_id"
VALID_PIPELINES = ("buy", "sell")


def _drive_request(method: str, path: str, body: dict = None, is_upload_api: bool = False) -> dict:
    """Authenticated request to Google Drive REST API v3."""
    token = _get_valid_access_token()
    if not token:
        raise PermissionError("Google Drive not connected. Please authorize via Settings.")
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
    # Search for existing folder
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
    """Get or create the root 'CAR-AGENTS Contracts' folder in My Drive."""
    # Try cache first
    try:
        sb = get_supabase()
        res = sb.table("google_auth").select("id").eq("id", "maxim_main").execute()
        # Store folder_id in google_auth row using a side-channel column isn't ideal
        # Use _find_or_create_folder directly
    except Exception:
        pass
    return _find_or_create_folder(ROOT_FOLDER_NAME)


async def upload_approved_contract_to_drive(
    customer_name: str,
    contract_filename: str,
    pdf_file_path: str,
    pipeline: str = "sell"
) -> dict:
    """
    Uploads an approved contract PDF to Google Drive under:
    My Drive / CAR-AGENTS Contracts / {pipeline} / {Customer Name} / {contract_filename}

    pipeline must be "buy" or "sell".
    Called ONLY AFTER explicit client/broker approval of contract accuracy.
    """
    if pipeline not in VALID_PIPELINES:
        return {"success": False, "error": f"Invalid pipeline '{pipeline}'. Must be one of: {', '.join(VALID_PIPELINES)}"}

    if not os.path.exists(pdf_file_path):
        return {"success": False, "error": f"File not found: {pdf_file_path}"}

    token = _get_valid_access_token()
    if not token:
        return {"success": False, "error": "Google Drive not connected. Authorize via Settings → App Connections."}

    # Clean customer name for folder
    clean_customer = "".join(c for c in customer_name if c.isalnum() or c in (" ", "_", "-")).strip() or "General Clients"

    try:
        # Step 1: Get/create root folder "CAR-AGENTS Contracts"
        root_id = _get_or_create_root_folder()
        logger.info(f"Root Drive folder ID: {root_id}")

        # Step 2: Get/create pipeline folder "buy" / "sell"
        pipeline_folder_id = _find_or_create_folder(pipeline, parent_id=root_id)
        logger.info(f"Pipeline folder ID for '{pipeline}': {pipeline_folder_id}")

        # Step 3: Get/create customer subfolder under the pipeline folder
        customer_folder_id = _find_or_create_folder(clean_customer, parent_id=pipeline_folder_id)
        logger.info(f"Customer folder ID for '{clean_customer}': {customer_folder_id}")

        # Step 4: Upload PDF using multipart upload
        with open(pdf_file_path, "rb") as f:
            pdf_bytes = f.read()

        # Build multipart body
        boundary = "car_agents_boundary_12345"
        metadata = json.dumps({
            "name": contract_filename,
            "parents": [customer_folder_id]
        }).encode("utf-8")

        body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        ).encode("utf-8") + metadata + (
            f"\r\n--{boundary}\r\n"
            f"Content-Type: application/pdf\r\n\r\n"
        ).encode("utf-8") + pdf_bytes + f"\r\n--{boundary}--".encode("utf-8")

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

        drive_url = uploaded.get("webViewLink", "")
        file_id = uploaded.get("id", "")

        logger.info(f"Uploaded '{contract_filename}' to Drive: {drive_url}")

        return {
            "success": True,
            "customer_name": clean_customer,
            "pipeline": pipeline,
            "drive_file_id": file_id,
            "drive_url": drive_url,
            "folder_path": f"My Drive / {ROOT_FOLDER_NAME} / {pipeline} / {clean_customer}",
            "message": f"Contract saved to Google Drive under '{ROOT_FOLDER_NAME} / {pipeline} / {clean_customer}'."
        }

    except Exception as e:
        logger.error(f"Google Drive upload error: {e}")
        return {"success": False, "error": str(e)}
