from sqlalchemy import Column, Integer, String, DateTime, Text
from app.database import Base
from datetime import datetime

class Comic(Base):
    __tablename__ = "comics"
    
    # Database columns
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    user_id = Column(String, index=True)  # Supabase user ID
    panels = Column(Text)  # JSON string of panel data
    audio_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Database relationships (if any)
    # user = relationship("User", back_populates="comics")
