from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import stripe
import os
import logging
from typing import Optional
from auth_shared import get_current_user
from services.user_credits import UserCreditsService
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/api/stripe", tags=["stripe"])
limiter = Limiter(key_func=get_remote_address)

# Credit packages configuration
CREDIT_PACKAGES = {
    "credits_50": {"price": 499, "credits": 50},    # $4.99 in cents - Starter
    "credits_120": {"price": 999, "credits": 120},  # $9.99 in cents - Popular
    "credits_280": {"price": 1999, "credits": 280}, # $19.99 in cents - Pro
    "credits_800": {"price": 4999, "credits": 800}, # $49.99 in cents - Creator
}

class PaymentIntentRequest(BaseModel):
    packageId: str
    userId: str

class PaymentIntentResponse(BaseModel):
    clientSecret: str

@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
@limiter.limit("10/minute")
async def create_payment_intent(
    raw_request: Request,
    request: PaymentIntentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe PaymentIntent for purchasing credits"""
    
    # Verify the package exists
    if request.packageId not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package ID")
    
    package = CREDIT_PACKAGES[request.packageId]
    
    try:
        # Create PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=package["price"],
            currency="usd",
            metadata={
                "userId": request.userId,
                "packageId": request.packageId,
                "credits": str(package["credits"])
            }
        )
        
        return PaymentIntentResponse(clientSecret=intent.client_secret)
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
@limiter.limit("100/minute")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for successful payments"""
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle successful payment
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        
        # Extract metadata
        user_id = payment_intent["metadata"]["userId"]
        package_id = payment_intent["metadata"]["packageId"]
        credits = int(payment_intent["metadata"]["credits"])
        
        # Add credits to user's account
        logger.info(f"Payment succeeded: User {user_id} purchased {credits} credits")
        
        try:
            credits_service = UserCreditsService()
            new_balance = await credits_service.add_credits(user_id, credits)
            logger.info(f"Successfully added {credits} credits to user {user_id}. New balance: {new_balance}")
        except Exception as e:
            logger.error(f"Failed to add credits to user {user_id}: {e}")
            # Note: We don't raise an exception here because the payment was successful
            # The credits can be added manually if needed
    
    return {"status": "success"}

@router.get("/user-credits")
@limiter.limit("50/minute")
async def get_user_credits(request: Request, current_user: dict = Depends(get_current_user)):
    """Get the current user's credit balance"""
    try:
        logger.info(f"Getting credits for user: {current_user['id']}")
        credits_service = UserCreditsService()
        credits = await credits_service.get_user_credits(current_user["id"])
        logger.info(f"Retrieved {credits} credits for user {current_user['id']}")
        return {"credits": credits}
    except Exception as e:
        logger.error(f"Error getting credits for user {current_user['id']}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve credits")

@router.get("/user-profile")
@limiter.limit("50/minute")
async def get_user_profile(request: Request, current_user: dict = Depends(get_current_user)):
    """Get the current user's profile information"""
    try:
        logger.info(f"Getting profile for user: {current_user['id']}")
        credits_service = UserCreditsService()
        credits = await credits_service.get_user_credits(current_user["id"])
        name = await credits_service.get_user_name(current_user["id"])
        logger.info(f"Retrieved profile for user {current_user['id']}: credits={credits}, name={name}")
        return {"credits": credits, "name": name}
    except Exception as e:
        logger.error(f"Error getting profile for user {current_user['id']}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")

@router.patch("/user-profile")
@limiter.limit("20/minute")
async def update_user_profile(request: Request, current_user: dict = Depends(get_current_user)):
    """Update the current user's profile information"""
    try:
        body = await request.json()
        name = body.get("name")
        
        if not name or not name.strip():
            raise HTTPException(status_code=400, detail="Name is required")
        
        logger.info(f"Updating profile for user: {current_user['id']}, name: {name}")
        credits_service = UserCreditsService()
        success = await credits_service.update_user_name(current_user["id"], name.strip())
        
        if success:
            logger.info(f"Successfully updated name for user {current_user['id']}")
            return {"success": True, "message": "Profile updated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update profile")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for user {current_user['id']}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update profile")

@router.get("/test-db")
@limiter.limit("20/minute")
async def test_database_connection(request: Request):
    """Test database connection and user_profiles table"""
    try:
        from services.user_credits import UserCreditsService
        credits_service = UserCreditsService()
        
        # Test direct table query
        result = credits_service.supabase.table('user_profiles').select('*').limit(1).execute()
        logger.info(f"Test query result: {result}")
        
        return {
            "status": "success",
            "message": "Database connection working",
            "sample_data": result.data[:1] if result.data else []
        }
    except Exception as e:
        logger.error(f"Database test failed: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/test-rpc")
@limiter.limit("20/minute")
async def test_rpc_function(request: Request):
    """Test RPC function directly"""
    try:
        from services.user_credits import UserCreditsService
        credits_service = UserCreditsService()
        
        # Test with a known user ID from the database
        test_user_id = "66f85aff-6270-48b2-9022-c56aa65b3653"
        
        # Test RPC call
        result = credits_service.supabase.rpc('get_user_credits', {'user_uuid': test_user_id}).execute()
        logger.info(f"RPC test result: {result}")
        
        return {
            "status": "success",
            "message": "RPC function working",
            "test_user_id": test_user_id,
            "rpc_result": result.data
        }
    except Exception as e:
        logger.error(f"RPC test failed: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }
