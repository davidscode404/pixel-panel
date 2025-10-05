# backend/services/comic_storage.py
import os
import base64
import math
import logging
from io import BytesIO
from supabase import create_client, Client
from typing import List, Optional
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

logger = logging.getLogger(__name__)

class ComicStorageService:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY')  # Service key for backend
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.bucket_name = "PixelPanel"
    
    async def save_comic(self, user_id: str, comic_title: str, panels_data: List[dict], thumbnail_data: Optional[str] = None, is_public: bool = False) -> str:
        """
        Save a complete comic with all panels
        Returns the comic_id and composite public URL
        """
        try:
            # 1. Create comic record in database
            comic_response = self.supabase.table('comics').insert({
                'title': comic_title,
                'user_id': user_id,
                'is_public': is_public
            }).execute()
            
            comic_id = comic_response.data[0]['id']
            
            # 2. Save each panel
            panel_images: List[Image.Image] = []
            base_panel_size = None
            for panel_data in panels_data:
                panel_id = panel_data['id']
                # Handle both old and new schema
                image_data = panel_data.get('image_data') or panel_data.get('largeCanvasData')
                
                if image_data:
                    # Upload to Supabase Storage
                    storage_path = f"users/{user_id}/comics/{comic_id}/panel_{panel_id}.png"
                    
                    # Convert base64 to bytes
                    # Handle both data URL format and raw base64
                    if image_data.startswith('data:'):
                        image_bytes = base64.b64decode(image_data.split(',')[1])
                    else:
                        image_bytes = base64.b64decode(image_data)
                    
                    # Upload to storage
                    self.supabase.storage.from_(self.bucket_name).upload(
                        path=storage_path,
                        file=image_bytes,
                        file_options={"content-type": "image/png"}
                    )
                    
                    # Get public URL
                    public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)

                    # Handle audio if available
                    audio_url = None
                    narration = panel_data.get('narration')
                    audio_data = panel_data.get('audio_data')

                    if audio_data:
                        audio_storage_path = f"users/{user_id}/comics/{comic_id}/audio/panel_{panel_id}.mp3"

                        try:
                            # Convert base64 to bytes
                            audio_bytes = base64.b64decode(audio_data)

                            # Upload audio to storage with upsert to allow overwriting
                            self.supabase.storage.from_(self.bucket_name).upload(
                                path=audio_storage_path,
                                file=audio_bytes,
                                file_options={"content-type": "audio/mpeg", "upsert": "true"}
                            )

                            # Get public URL for audio
                            audio_url = self.supabase.storage.from_(self.bucket_name).get_public_url(audio_storage_path)
                            logger.info(f"Audio uploaded for panel {panel_id}: {audio_url}")
                        except Exception as audio_err:
                            logger.warning(f"Failed to upload audio for panel {panel_id}: {audio_err}", exc_info=True)

                    # Save panel metadata to database
                    self.supabase.table('comic_panels').insert({
                        'comic_id': comic_id,
                        'panel_number': panel_id,
                        'storage_path': storage_path,
                        'public_url': public_url,
                        'file_size': len(image_bytes),
                        'narration': narration,
                        'audio_url': audio_url
                    }).execute()

                    # Keep PIL image for composite
                    try:
                        img = Image.open(BytesIO(image_bytes)).convert("RGB")
                        if base_panel_size is None:
                            base_panel_size = img.size
                        # Normalize size to the first panel's size
                        if img.size != base_panel_size:
                            img = img.resize(base_panel_size)
                        panel_images.append((panel_id, img))
                    except Exception as pil_err:
                        logger.warning(f"Failed to open panel {panel_id} for composite: {pil_err}", exc_info=True)
            
            # 3. Create thumbnail/composite image
            composite_public_url: Optional[str] = None
            thumbnail_bytes = None

            # Use custom thumbnail if provided, otherwise create composite
            if thumbnail_data:
                logger.info("Using custom thumbnail")
                # Handle both data URL format and raw base64
                if thumbnail_data.startswith('data:'):
                    thumbnail_bytes = base64.b64decode(thumbnail_data.split(',')[1])
                else:
                    thumbnail_bytes = base64.b64decode(thumbnail_data)
            elif panel_images:
                logger.info("Creating composite thumbnail from panels")
                # Sort by panel number to place in order
                panel_images.sort(key=lambda t: t[0])
                _, first_img = panel_images[0]
                w, h = first_img.size
                cols = 2
                rows = math.ceil(len(panel_images) / cols)
                composite = Image.new("RGB", (w * cols, h * rows), color=(255, 255, 255))
                for idx, (_pid, img) in enumerate(panel_images):
                    x = (idx % cols) * w
                    y = (idx // cols) * h
                    composite.paste(img, (x, y))

                # Save composite to bytes
                buf = BytesIO()
                composite.save(buf, format="PNG")
                thumbnail_bytes = buf.getvalue()

            if thumbnail_bytes:
                # Upload thumbnail/composite
                composite_path = f"users/{user_id}/comics/{comic_id}/thumbnail.png"
                self.supabase.storage.from_(self.bucket_name).upload(
                    path=composite_path,
                    file=thumbnail_bytes,
                    file_options={"content-type": "image/png", "upsert": "true"}
                )
                composite_public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(composite_path)

                # Store thumbnail as a special panel_number 0 record
                self.supabase.table('comic_panels').insert({
                    'comic_id': comic_id,
                    'panel_number': 0,
                    'storage_path': composite_path,
                    'public_url': composite_public_url,
                    'file_size': len(thumbnail_bytes)
                }).execute()
            
            return {"comic_id": comic_id, "composite_public_url": composite_public_url}
            
        except Exception as e:
            logger.error(f"Error saving comic: {e}", exc_info=True)
            raise
    
    async def get_user_comics(self, user_id: str) -> List[dict]:
        """Get all comics for a user"""
        response = self.supabase.table('comics').select("""
            id, title, is_public, created_at, updated_at,
            comic_panels(id, panel_number, public_url, storage_path, file_size, created_at, narration, audio_url)
        """).eq('user_id', user_id).order('created_at', desc=True).execute()
        
        return response.data
    
    async def get_public_comics(self) -> List[dict]:
        """Get all public comics from all users with user display names"""
        # First get the comics
        comics_response = self.supabase.table('comics').select("""
            id, title, user_id, is_public, created_at, updated_at,
            comic_panels(id, panel_number, public_url, storage_path, file_size, created_at, narration, audio_url)
        """).eq('is_public', True).order('created_at', desc=True).execute()
        
        comics = comics_response.data
        
        # Get unique user IDs
        user_ids = list(set(comic['user_id'] for comic in comics if comic.get('user_id')))
        
        # Fetch user names
        user_names = {}
        if user_ids:
            profiles_response = self.supabase.table('user_profiles').select('user_id, name').in_('user_id', user_ids).execute()
            user_names = {profile['user_id']: profile.get('name') for profile in profiles_response.data}
        
        # Add user names to comics
        for comic in comics:
            comic['user_profiles'] = {
                'name': user_names.get(comic.get('user_id'))
            }
        
        return comics
    
    async def get_all_comics(self) -> List[dict]:
        """Get all comics from all users for exploration"""
        response = self.supabase.table('comics').select("""
            id, title, created_at, updated_at,
            comic_panels(id, panel_number, public_url)
        """).order('created_at', desc=True).execute()
        
        return response.data
    
    async def get_comic_panels(self, comic_id: str) -> List[dict]:
        """Get all panels for a specific comic"""
        response = self.supabase.table('comic_panels').select("*").eq('comic_id', comic_id).order('panel_number').execute()
        return response.data
    
    async def save_panel(self, user_id: str, comic_title: str, panel_id: int, image_data: str) -> dict:
        """
        Save a single panel to Supabase Storage and database
        Returns panel metadata
        """
        try:
            # 1. Check if comic already exists, create if not
            existing_comic = self.supabase.table('comics').select('id').eq('title', comic_title).eq('user_id', user_id).execute()
            
            if existing_comic.data:
                comic_id = existing_comic.data[0]['id']
                logger.info(f"Using existing comic ID: {comic_id}")
            else:
                # Create new comic record
                comic_response = self.supabase.table('comics').insert({
                    'title': comic_title,
                    'user_id': user_id,
                    'is_public': False
                }).execute()
                comic_id = comic_response.data[0]['id']
                logger.info(f"Created new comic with ID: {comic_id}")
            
            # 2. Upload panel to Supabase Storage
            storage_path = f"users/{user_id}/comics/{comic_id}/panel_{panel_id}.png"
            
            # Convert base64 to bytes
            image_bytes = base64.b64decode(image_data)
            
            # Upload to storage
            upload_result = self.supabase.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=image_bytes,
                file_options={"content-type": "image/png", "upsert": "true"}
            )
            
            logger.debug(f"Storage upload result: {upload_result}")
            
            # Get public URL
            public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)
            
            # 3. Save/update panel metadata in database
            existing_panel = self.supabase.table('comic_panels').select('id').eq('comic_id', comic_id).eq('panel_number', panel_id).execute()
            
            panel_data = {
                'comic_id': comic_id,
                'panel_number': panel_id,
                'storage_path': storage_path,
                'public_url': public_url,
                'file_size': len(image_bytes)
            }
            
            if existing_panel.data:
                # Update existing panel
                update_result = self.supabase.table('comic_panels').update(panel_data).eq('id', existing_panel.data[0]['id']).execute()
                logger.info(f"Updated panel {panel_id} in database")
            else:
                # Insert new panel
                insert_result = self.supabase.table('comic_panels').insert(panel_data).execute()
                logger.info(f"Saved panel {panel_id} to database")
            
            return {
                'comic_id': comic_id,
                'panel_id': panel_id,
                'storage_path': storage_path,
                'public_url': public_url,
                'file_size': len(image_bytes)
            }
            
        except Exception as e:
            logger.error(f"Error saving panel to Supabase: {e}", exc_info=True)
            raise

    async def delete_comic(self, user_id: str, comic_id: str) -> bool:
        """Delete a comic and all its panels"""
        try:
            # First, check if the comic exists and belongs to the user
            comic_check = self.supabase.table('comics').select('id, title').eq('id', comic_id).eq('user_id', user_id).execute()
            
            if not comic_check.data:
                return False
            
            # Get all panel storage paths
            panels = await self.get_comic_panels(comic_id)
            
            # Delete files from storage
            for panel in panels:
                self.supabase.storage.from_(self.bucket_name).remove([panel['storage_path']])
            
            # Delete from database (cascade will handle panels)
            self.supabase.table('comics').delete().eq('id', comic_id).eq('user_id', user_id).execute()
            
            return True
        except Exception as e:
            logger.error(f"Error deleting comic: {e}", exc_info=True)
            return False