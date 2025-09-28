from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class PanelData(BaseModel):
    id: int
    prompt: str
    image_data: str
    is_zoomed: bool = False

class ComicCreate(BaseModel):
    """Schema for creating a new comic (API request)"""
    title: str
    panels: List[PanelData]

class ComicUpdate(BaseModel):
    """Schema for updating a comic (API request)"""
    title: Optional[str] = None
    panels: Optional[List[PanelData]] = None

class ComicResponse(BaseModel):
    """Schema for comic data in API responses"""
    id: int
    title: str
    user_id: str
    panels: str  # JSON string (as stored in DB)
    audio_url: Optional[str] = None
    video_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True  # Allows conversion from SQLAlchemy models

class ComicArtRequest(BaseModel):
    """Schema for comic art generation requests"""
    text_prompt: str
    reference_image: Optional[str] = None  # Base64 encoded image data
    panel_id: Optional[int] = None
    previous_panel_context: Optional['PanelContext'] = None

class PanelContext(BaseModel):
    """Schema for previous panel context"""
    prompt: str
    image_data: str

class ComicRequest(BaseModel):
    """Schema for comic operations (save, load, etc.)"""
    comic_title: str
    panels_data: Optional[List[PanelData]] = None
    panel_id: Optional[int] = None
    image_data: Optional[str] = None
