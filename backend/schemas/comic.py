# backend/schemas/comic.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class PanelData(BaseModel):
    id: int
    prompt: str
    image_data: str
    is_zoomed: bool = False

class ComicArtRequest(BaseModel):
    text_prompt: str
    reference_image: Optional[str] = None  # Base64 encoded image data (optional)
    panel_id: Optional[int] = None  # Panel ID to track generation order

class ComicRequest(BaseModel):
    title: str
    panels: List[PanelData]

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
    success: bool
    image_data: Optional[str] = None
    message: str

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
