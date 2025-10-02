# backend/auth_shared.py
from fastapi import HTTPException, Request
import os
import httpx
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

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
        # Get the Authorization header
        auth_header = request.headers.get("Authorization")
        logger.debug(f"Auth header present: {bool(auth_header)}")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning("Missing or invalid Authorization header")
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authorization header"
            )
        
        # Extract the token
        token = auth_header.split(" ")[1]
        logger.debug(f"Token length: {len(token)}")
        logger.debug(f"Token starts with: {token[:50]}...")
        
        # Check if token has proper JWT structure (3 parts separated by dots)
        token_parts = token.split('.')
        logger.debug(f"Token parts count: {len(token_parts)}")
        
        if len(token_parts) != 3:
            logger.warning("Invalid JWT token structure")
            raise HTTPException(
                status_code=401,
                detail="Invalid token format"
            )
        
        try:
            # Verify token with Supabase
            async with httpx.AsyncClient() as client:
                auth_response = await client.get(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": supabase_anon_key
                    }
                )
                
                if auth_response.status_code != 200:
                    logger.warning(f"Token verification failed with status: {auth_response.status_code}")
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired token"
                    )
                
                user_data = auth_response.json()
                logger.info(f"User authenticated: {user_data.get('email', 'Unknown')}")
                
                return {
                    "id": user_data.get("id"),
                    "email": user_data.get("email"),
                    "user_metadata": user_data.get("user_metadata", {})
                }
                
        except httpx.HTTPError as e:
            logger.error(f"JWT verification HTTP error: {e}", exc_info=True)
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )
        except Exception as e:
            logger.error(f"JWT verification error: {e}", exc_info=True)
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}", exc_info=True)
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )
