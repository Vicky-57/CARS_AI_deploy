import sys
import os

# Add backend to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_supabase
from app.services.google_service import _get_valid_access_token
from app.services.gdrive_service import _get_or_create_root_folder, _find_or_create_folder, ROOT_FOLDER_NAME

def main():
    print("==========================================")
    print("       GOOGLE DRIVE CONNECTION TEST       ")
    print("==========================================")
    
    try:
        sb = get_supabase()
        print("1. Connecting to Supabase...")
        res = sb.table("google_auth").select("*").execute()
        rows = res.data or []
        print(f"   Found {len(rows)} record(s) in 'google_auth' table.")
        
        for r in rows:
            print(f"   - Row ID: {r.get('id')}")
            print(f"     Connected Email: {r.get('connected_email')}")
            print(f"     Token Expiry: {r.get('token_expiry')}")
            print(f"     Has Refresh Token: {bool(r.get('refresh_token'))}")
            print(f"     Has Access Token: {bool(r.get('access_token'))}")
            
        print("\n2. Requesting Valid Access Token...")
        token = _get_valid_access_token()
        if not token:
            print("   ❌ FAILED: No valid access token could be retrieved. Account needs authorization via Google OAuth.")
            return

        print("   ✅ Access token retrieved/refreshed successfully!")
        
        print("\n3. Testing Google Drive API (Folder Hierarchy)...")
        root_id = _get_or_create_root_folder()
        print(f"   ✅ Root Folder '{ROOT_FOLDER_NAME}' verified. ID: {root_id}")
        
        test_folder_id = _find_or_create_folder("Test_Verification_Folder", parent_id=root_id)
        print(f"   ✅ Test Subfolder verified/created. ID: {test_folder_id}")
        
        print("\n🎉 SUCCESS: Google Drive integration is 100% working!")
        
    except Exception as e:
        print(f"\n❌ ERROR during Google Drive test: {e}")

if __name__ == "__main__":
    main()
