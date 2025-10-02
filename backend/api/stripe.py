from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import stripe
import os
import logging
from typing import Optional
from auth_shared import get_current_user

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter()

# Credit packages configuration
CREDIT_PACKAGES = {
    "credits_10": {"price": 500, "credits": 10},  # $5.00 in cents
    "credits_25": {"price": 1000, "credits": 25},  # $10.00 in cents
    "credits_50": {"price": 1800, "credits": 50},  # $18.00 in cents
    "credits_100": {"price": 3000, "credits": 100},  # $30.00 in cents
}

class PaymentIntentRequest(BaseModel):
    packageId: str
    userId: str

class PaymentIntentResponse(BaseModel):
    clientSecret: str

@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
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
async def stripe_webhook(request):
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
        
        # TODO: Add credits to user's account in your database
        # This would typically involve updating a user_credits table
        logger.info(f"Payment succeeded: User {user_id} purchased {credits} credits")
        
        # Here you would update your database to add credits to the user
        # Example:
        # await add_credits_to_user(user_id, credits)
    
    return {"status": "success"}
