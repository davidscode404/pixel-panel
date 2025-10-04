from fastapi import HTTPException, FastAPI
from starlette.requests import Request
import uvicorn
import logging
import sys
import os

from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from api.comics import router as comics_router
from api.voice_over import router as voice_over_router
from api.stripe import router as stripe_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="PixelPanel", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Health check endpoint
@app.get("/health")
@limiter.limit("100/minute")
async def health_check(request: Request):
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

# Include the new API routers
app.include_router(comics_router)
app.include_router(voice_over_router)
app.include_router(stripe_router)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)