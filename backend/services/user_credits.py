"""
User Credits Service
Handles credit management for users including adding, deducting, and checking credits.
"""

import logging
from typing import Optional
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class UserCreditsService:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        # Use service role key for backend operations to bypass RLS
        self.supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase_anon_key = os.getenv('SUPABASE_ANON_KEY')
        
        # Use service role key if available, otherwise fall back to anon key
        key_to_use = self.supabase_service_key or self.supabase_anon_key
        key_type = "service_role" if self.supabase_service_key else "anon"
        logger.info(f"Using {key_type} key for Supabase client")
        self.supabase: Client = create_client(self.supabase_url, key_to_use)
    
    async def get_user_credits(self, user_id: str) -> int:
        """Get the current credit balance for a user"""
        try:
            logger.info(f"Getting credits for user {user_id}")
            result = self.supabase.rpc('get_user_credits', {'user_uuid': user_id}).execute()
            logger.info(f"RPC result: {result}")
            logger.info(f"RPC data: {result.data}")
            
            # Handle the result properly - RPC function returns integer directly
            if result.data is not None:
                if isinstance(result.data, int):
                    credits = result.data
                elif isinstance(result.data, list) and len(result.data) > 0:
                    credits = result.data[0].get('get_user_credits', 0)
                else:
                    credits = 0
            else:
                credits = 0
                
            logger.info(f"User {user_id} has {credits} credits")
            return credits
        except Exception as e:
            logger.error(f"Error getting credits for user {user_id}: {e}", exc_info=True)
            return 0
    
    async def add_credits(self, user_id: str, credits_to_add: int) -> int:
        """Add credits to a user's account and return the new balance"""
        try:
            result = self.supabase.rpc('add_user_credits', {
                'user_uuid': user_id,
                'credits_to_add': credits_to_add
            }).execute()
            
            new_credits = result.data if result.data is not None else 0
            logger.info(f"Added {credits_to_add} credits to user {user_id}. New balance: {new_credits}")
            return new_credits
        except Exception as e:
            logger.error(f"Error adding credits for user {user_id}: {e}")
            raise
    
    async def deduct_credits(self, user_id: str, credits_to_deduct: int) -> int:
        """Deduct credits from a user's account and return the new balance"""
        try:
            result = self.supabase.rpc('deduct_user_credits', {
                'user_uuid': user_id,
                'credits_to_deduct': credits_to_deduct
            }).execute()
            
            new_credits = result.data if result.data is not None else 0
            logger.info(f"Deducted {credits_to_deduct} credits from user {user_id}. New balance: {new_credits}")
            return new_credits
        except Exception as e:
            logger.error(f"Error deducting credits for user {user_id}: {e}")
            raise
    
    async def has_sufficient_credits(self, user_id: str, required_credits: int) -> bool:
        """Check if a user has sufficient credits for an operation"""
        try:
            result = self.supabase.rpc('has_sufficient_credits', {
                'user_uuid': user_id,
                'required_credits': required_credits
            }).execute()
            
            has_credits = result.data if result.data is not None else False
            logger.info(f"User {user_id} has sufficient credits ({required_credits}): {has_credits}")
            return has_credits
        except Exception as e:
            logger.error(f"Error checking credits for user {user_id}: {e}")
            return False
    
    async def get_user_name(self, user_id: str) -> Optional[str]:
        """Get the user's name from their profile"""
        try:
            result = self.supabase.table('user_profiles').select('name').eq('user_id', user_id).execute()
            
            if result.data and len(result.data) > 0:
                name = result.data[0].get('name')
                logger.info(f"User {user_id} name: {name}")
                return name
            else:
                logger.info(f"No name found for user {user_id}")
                return None
        except Exception as e:
            logger.error(f"Error getting name for user {user_id}: {e}")
            return None
    
    async def update_user_name(self, user_id: str, name: str) -> bool:
        """Update the user's name in their profile"""
        try:
            # Ensure profile exists first
            await self.ensure_user_profile(user_id)
            
            # Update the name
            result = self.supabase.table('user_profiles').update({
                'name': name
            }).eq('user_id', user_id).execute()
            
            logger.info(f"Updated name for user {user_id} to: {name}")
            return True
        except Exception as e:
            logger.error(f"Error updating name for user {user_id}: {e}")
            return False
    
    async def ensure_user_profile(self, user_id: str) -> bool:
        """Ensure a user has a profile record (creates one if it doesn't exist)"""
        try:
            # Try to get existing profile
            result = self.supabase.table('user_profiles').select('id').eq('user_id', user_id).execute()
            
            if not result.data:
                # Create new profile with 0 credits
                self.supabase.table('user_profiles').insert({
                    'user_id': user_id,
                    'credits': 0
                }).execute()
                logger.info(f"Created new profile for user {user_id}")
                return True
            else:
                logger.info(f"Profile already exists for user {user_id}")
                return True
        except Exception as e:
            logger.error(f"Error ensuring profile for user {user_id}: {e}")
            return False

