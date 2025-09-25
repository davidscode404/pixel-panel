# backend/services/comic_storage.py
import os
import base64
import math
from io import BytesIO
from supabase import create_client, Client
from typing import List, Optional
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

class ComicStorageService:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY')  # Service key for backend
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.bucket_name = "PixelPanel"
    
    async def save_comic(self, user_id: str, comic_title: str, panels_data: List[dict]) -> str:
        """
        Save a complete comic with all panels
        Returns the comic_id and composite public URL
        """
        try:
            # 1. Create comic record in database
            comic_response = self.supabase.table('comics').insert({
                'title': comic_title,
                'user_id': user_id,
                'is_public': False
            }).execute()
            
            comic_id = comic_response.data[0]['id']
            
            # 2. Save each panel
            panel_images: List[Image.Image] = []
            base_panel_size = None
            for panel_data in panels_data:
                panel_id = panel_data['id']
                image_data = panel_data['largeCanvasData']
                
                if image_data:
                    # Upload to Supabase Storage
                    storage_path = f"users/{user_id}/comics/{comic_id}/panel_{panel_id}.png"
                    
                    # Convert base64 to bytes
                    image_bytes = base64.b64decode(image_data.split(',')[1])
                    
                    # Upload to storage
                    self.supabase.storage.from_(self.bucket_name).upload(
                        path=storage_path,
                        file=image_bytes,
                        file_options={"content-type": "image/png"}
                    )
                    
                    # Get public URL
                    public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)
                    
                    # Save panel metadata to database
                    self.supabase.table('comic_panels').insert({
                        'comic_id': comic_id,
                        'panel_number': panel_id,
                        'storage_path': storage_path,
                        'public_url': public_url,
                        'file_size': len(image_bytes)
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
                        print(f"Warning: failed to open panel {panel_id} for composite: {pil_err}")
            
            # 3. Create composite image (grid: 2 columns, rows as needed)
            composite_public_url: Optional[str] = None
            if panel_images:
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
                composite_bytes = buf.getvalue()

                # Upload composite
                composite_path = f"users/{user_id}/comics/{comic_id}/comic_full.png"
                self.supabase.storage.from_(self.bucket_name).upload(
                    path=composite_path,
                    file=composite_bytes,
                    file_options={"content-type": "image/png", "upsert": "true"}
                )
                composite_public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(composite_path)

                # Store composite as a special panel_number 0 record
                self.supabase.table('comic_panels').insert({
                    'comic_id': comic_id,
                    'panel_number': 0,
                    'storage_path': composite_path,
                    'public_url': composite_public_url,
                    'file_size': len(composite_bytes)
                }).execute()
            
            return {"comic_id": comic_id, "composite_public_url": composite_public_url}
            
        except Exception as e:
            print(f"Error saving comic: {e}")
            raise
    
    async def get_user_comics(self, user_id: str) -> List[dict]:
        """Get all comics for a user"""
        response = self.supabase.table('comics').select("""
            id, title, created_at, updated_at,
            comic_panels(id, panel_number, public_url)
        """).eq('user_id', user_id).order('created_at', desc=True).execute()
        
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
                print(f"📚 Using existing comic ID: {comic_id}")
            else:
                # Create new comic record
                comic_response = self.supabase.table('comics').insert({
                    'title': comic_title,
                    'user_id': user_id,
                    'is_public': False
                }).execute()
                comic_id = comic_response.data[0]['id']
                print(f"📚 Created new comic with ID: {comic_id}")
            
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
            
            print(f"📤 Storage upload result: {upload_result}")
            
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
                print(f"📊 Updated panel {panel_id} in database: {update_result}")
            else:
                # Insert new panel
                insert_result = self.supabase.table('comic_panels').insert(panel_data).execute()
                print(f"📊 Saved panel {panel_id} to database: {insert_result}")
            
            return {
                'comic_id': comic_id,
                'panel_id': panel_id,
                'storage_path': storage_path,
                'public_url': public_url,
                'file_size': len(image_bytes)
            }
            
        except Exception as e:
            print(f"Error saving panel to Supabase: {e}")
            raise

    async def delete_comic(self, user_id: str, comic_id: str) -> bool:
        """Delete a comic and all its panels"""
        try:
            # Get all panel storage paths
            panels = await self.get_comic_panels(comic_id)
            
            # Delete files from storage
            for panel in panels:
                self.supabase.storage.from_(self.bucket_name).remove([panel['storage_path']])
            
            # Delete from database (cascade will handle panels)
            self.supabase.table('comics').delete().eq('id', comic_id).eq('user_id', user_id).execute()
            
            return True
        except Exception as e:
            print(f"Error deleting comic: {e}")
            return False