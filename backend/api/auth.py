# backend/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, Request
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx


load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_anon_key = os.getenv('SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_anon_key)

async def get_current_user(request: Request) -> dict:
    """
    Extract and validate JWT token from Authorization header
    Returns the user data if valid, raises HTTPException if invalid
    """
    try:
        auth_header = request.headers.get("Authorization")
        print(f"🔍 DEBUG: Auth header: {auth_header}")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            print("❌ Missing or invalid Authorization header")
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authorization header"
            )
        
        token = auth_header.split(" ")[1]
        print(f"🔍 DEBUG: Token length: {len(token)}")
        print(f"🔍 DEBUG: Token starts with: {token[:50]}...")
        
        token_parts = token.split('.')
        print(f"🔍 DEBUG: Token parts count: {len(token_parts)}")
        
        try:
            async with httpx.AsyncClient() as client:
                auth_response = await client.get(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": supabase_anon_key
                    }
                )
                
                if auth_response.status_code != 200:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired token"
                    )
                
                user_data = auth_response.json()
                return {
                    "id": user_data.get("id"),
                    "email": user_data.get("email"),
                    "user_metadata": user_data.get("user_metadata", {})
                }
                
        except httpx.HTTPError as e:
            print(f"JWT verification HTTP error: {e}")
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )
        except Exception as e:
            print(f"JWT verification error: {e}")
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return current_user