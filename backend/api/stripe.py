from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import stripe
import os
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any
from auth_shared import get_current_user
from services.user_credits import UserCreditsService
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')  # Use service key for admin operations
supabase = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/api/stripe", tags=["stripe"])
limiter = Limiter(key_func=get_remote_address)

# Subscription Plans Configuration
SUBSCRIPTION_PLANS = {
    "free": {
        "name": "Free",
        "price": 0,
        "credits": 100,
        "price_id": None,
        "features": ["Basic comic generation", "Standard quality"]
    },
    "starter": {
        "name": "Starter",
        "price": 499,  # $4.99 in cents
        "credits": 500,
        "price_id": os.getenv("STRIPE_STARTER_PRICE_ID"),
        "features": ["High-quality generation", "Priority support"]
    },
    "pro": {
        "name": "Pro",
        "price": 999,  # $9.99 in cents
        "credits": 1200,
        "price_id": os.getenv("STRIPE_PRO_PRICE_ID"),
        "features": ["Premium features", "Advanced voice", "Custom training"]
    },
    "creator": {
        "name": "Creator",
        "price": 1999,  # $19.99 in cents
        "credits": 2800,
        "price_id": os.getenv("STRIPE_CREATOR_PRICE_ID"),
        "features": ["All Pro features", "Enhanced capabilities"]
    },
    "content_machine": {
        "name": "Content Machine",
        "price": 4999,  # $49.99 in cents
        "credits": 8000,
        "price_id": os.getenv("STRIPE_CONTENT_MACHINE_PRICE_ID"),
        "features": ["Maximum credits", "All premium features"]
    }
}


# Request/Response Models

class UserCreditsResponse(BaseModel):
    credits: int
    plan_type: str
    status: str

class SubscriptionStatusResponse(BaseModel):
    plan_type: str
    status: str
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    next_billing_date: Optional[str] = None

class UserProfileResponse(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    credits: int
    plan_type: str
    status: str
    stripe_customer_id: Optional[str] = None

class UpdateUserProfileRequest(BaseModel):
    name: Optional[str] = None

# Helper Functions
async def get_or_create_user_profile(user_id: str, stripe_customer_id: str = None) -> Dict[str, Any]:
    """Get or create user profile in database"""
    try:
        # Try to get existing profile
        result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        
        if result.data:
            profile = result.data[0]
            # Update stripe_customer_id if provided and not set
            if stripe_customer_id and not profile.get("stripe_customer_id"):
                supabase.table("user_profiles").update({
                    "stripe_customer_id": stripe_customer_id,
                    "updated_at": "now()"
                }).eq("user_id", user_id).execute()
                profile["stripe_customer_id"] = stripe_customer_id
            return profile
        else:
            # Create new profile for authenticated user
            new_profile = {
                "user_id": user_id,
                "credits": 100,  # Free tier credits
                "stripe_customer_id": stripe_customer_id,
                "plan_type": "free",
                "status": "active"
            }
            result = supabase.table("user_profiles").insert(new_profile).execute()
            return result.data[0] if result.data else new_profile
            
    except Exception as e:
        logger.error(f"Error getting/creating user profile: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while accessing user profile"
        )

async def add_credits_to_user(user_id: str, credits: int, source: str = "purchase") -> bool:
    """Add credits to user's account"""
    try:
        # Get current profile
        profile = await get_or_create_user_profile(user_id)
        current_credits = profile.get("credits", 0)
        new_credits = current_credits + credits
        
        # Update credits
        supabase.table("user_profiles").update({
            "credits": new_credits,
            "updated_at": "now()"
        }).eq("user_id", user_id).execute()
        
        logger.info(f"Added {credits} credits to user {user_id} from {source}. New balance: {new_credits}")
        return True
        
    except Exception as e:
        logger.error(f"Error adding credits to user {user_id}: {e}")
        return False

async def update_subscription_status(user_id: str, plan_type: str, status: str, 
                                   stripe_customer_id: str = None, stripe_subscription_id: str = None):
    """Update user's subscription status"""
    try:
        # First ensure user profile exists
        await get_or_create_user_profile(user_id)
        
        update_data = {
            "plan_type": plan_type,
            "status": status,
            "updated_at": "now()"
        }
        
        if stripe_customer_id:
            update_data["stripe_customer_id"] = stripe_customer_id
        if stripe_subscription_id:
            update_data["stripe_subscription_id"] = stripe_subscription_id
            
        supabase.table("user_profiles").update(update_data).eq("user_id", user_id).execute()
        logger.info(f"Updated subscription for user {user_id}: {plan_type} - {status}")
        
    except Exception as e:
        logger.error(f"Error updating subscription status for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while updating subscription status"
        )

# API Endpoints



@router.post("/webhook")
@limiter.limit("100/minute")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for subscription and payment events"""
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET environment variable not set")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        logger.error("Invalid payload in webhook")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError as e:
        logger.error(f"Invalid signature in webhook: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    data = event["data"]["object"]
    
    logger.info(f"Processing webhook event: {event_type}")
    
    try:
        if event_type == "checkout.session.completed":
            await handle_checkout_session_completed(data)
        elif event_type == "customer.subscription.created":
            await handle_subscription_created(data)
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(data)
        elif event_type == "invoice.payment_succeeded":
            await handle_invoice_payment_succeeded(data)
        elif event_type == "invoice.payment_failed":
            await handle_invoice_payment_failed(data)
        else:
            logger.info(f"Unhandled event type: {event_type}")
    
    except Exception as e:
        logger.error(f"Error processing webhook event {event_type}: {e}")
        # Don't raise exception to avoid webhook retries for non-critical errors
    return {"status": "success"}

async def handle_checkout_session_completed(session_data):
    """Handle successful checkout session completion"""
    customer_id = session_data.get("customer")
    subscription_id = session_data.get("subscription")
    user_id = session_data.get("metadata", {}).get("user_id")
    
    if not user_id:
        logger.warning("No user_id in checkout session metadata")
        return
    
    # Get subscription details
    if subscription_id:
        subscription = stripe.Subscription.retrieve(subscription_id)
        price_id = subscription["items"]["data"][0]["price"]["id"]
        
        # Find plan by price_id
        plan_type = "free"
        for plan, details in SUBSCRIPTION_PLANS.items():
            if details["price_id"] == price_id:
                plan_type = plan
                break
        
        # Update user profile
        await update_subscription_status(
            user_id, plan_type, "active", customer_id, subscription_id
        )
        
        # Add initial credits
        credits = SUBSCRIPTION_PLANS[plan_type]["credits"]
        await add_credits_to_user(user_id, credits, "subscription_created")
        
        logger.info(f"Checkout completed: User {user_id} subscribed to {plan_type}")

async def handle_subscription_created(subscription_data):
    """Handle new subscription creation"""
    customer_id = subscription_data.get("customer")
    subscription_id = subscription_data.get("id")
    
    if not customer_id:
        logger.error("No customer_id in subscription data")
        return
    
    # Try to get user_id from subscription metadata first
    user_id = subscription_data.get("metadata", {}).get("user_id")
    
    if not user_id:
        # Fallback: Find user by customer_id
        result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
        
        if not result.data:
            # Try to get customer from Stripe to find email
            try:
                customer = stripe.Customer.retrieve(customer_id)
                customer_metadata_user_id = customer.get("metadata", {}).get("user_id")
                
                if customer_metadata_user_id:
                    user_id = customer_metadata_user_id
                else:
                    logger.warning(f"No user_id found in customer metadata for {customer_id}")
                    return
                    
            except Exception as e:
                logger.error(f"Error retrieving customer {customer_id}: {e}")
                return
        else:
            user_id = result.data[0]["user_id"]
    
    if not user_id:
        logger.error(f"Could not determine user_id for subscription {subscription_id}")
        return
    
    # Ensure user profile exists
    await get_or_create_user_profile(user_id, customer_id)
    
    # Get subscription price_id
    price_id = subscription_data["items"]["data"][0]["price"]["id"]
    
    # Find plan by price_id
    plan_type = "free"
    for plan, details in SUBSCRIPTION_PLANS.items():
        if details["price_id"] == price_id:
            plan_type = plan
            break
    
    # Update subscription status
    await update_subscription_status(
        user_id, plan_type, "active", customer_id, subscription_id
    )
    
    # Add initial credits
    credits = SUBSCRIPTION_PLANS[plan_type]["credits"]
    await add_credits_to_user(user_id, credits, "subscription_created")
    
    logger.info(f"Subscription created: User {user_id} subscribed to {plan_type}")

async def handle_subscription_updated(subscription_data):
    """Handle subscription updates (plan changes, status updates)"""
    customer_id = subscription_data.get("customer")
    subscription_id = subscription_data.get("id")
    status = subscription_data.get("status")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"No user found for customer {customer_id}")
        return
    
    user_id = result.data[0]["user_id"]
    
    # Determine plan type
    plan_type = "free"
    if subscription_data.get("items", {}).get("data"):
        price_id = subscription_data["items"]["data"][0]["price"]["id"]
        for plan, details in SUBSCRIPTION_PLANS.items():
            if details["price_id"] == price_id:
                plan_type = plan
                break
    
    # Update subscription status (no credits added on updates)
    await update_subscription_status(
        user_id, plan_type, status, customer_id, subscription_id
    )
    
    logger.info(f"Subscription updated: User {user_id} - {plan_type} - {status}")

async def handle_subscription_deleted(subscription_data):
    """Handle subscription cancellation"""
    customer_id = subscription_data.get("customer")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"No user found for customer {customer_id}")
        return
    
    user_id = result.data[0]["user_id"]
    
    # Mark subscription as cancelled (user keeps all credits)
    await update_subscription_status(
        user_id, "free", "cancelled", customer_id, None
    )
    
    logger.info(f"Subscription cancelled: User {user_id}")

async def handle_invoice_payment_succeeded(invoice_data):
    """Handle successful monthly subscription payments"""
    customer_id = invoice_data.get("customer")
    subscription_id = invoice_data.get("subscription")
    
    if not subscription_id:
        return  # Not a subscription invoice
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"No user found for customer {customer_id}")
        return
    
    user_id = result.data[0]["user_id"]
    
    # Get subscription details
    subscription = stripe.Subscription.retrieve(subscription_id)
    price_id = subscription["items"]["data"][0]["price"]["id"]
    
    # Find plan by price_id
    plan_type = "free"
    for plan, details in SUBSCRIPTION_PLANS.items():
        if details["price_id"] == price_id:
            plan_type = plan
            break
    
    # Add monthly credits (additive approach)
    credits = SUBSCRIPTION_PLANS[plan_type]["credits"]
    await add_credits_to_user(user_id, credits, "monthly_renewal")
    
    logger.info(f"Monthly renewal: User {user_id} received {credits} credits for {plan_type}")

async def handle_invoice_payment_failed(invoice_data):
    """Handle failed subscription payments"""
    customer_id = invoice_data.get("customer")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"No user found for customer {customer_id}")
        return
    
    user_id = result.data[0]["user_id"]
    
    # Update subscription status to past_due
    await update_subscription_status(
        user_id, result.data[0]["plan_type"], "past_due", customer_id, None
    )
    
    logger.warning(f"Payment failed: User {user_id} subscription is past due")



@router.get("/user-credits", response_model=UserCreditsResponse)
@limiter.limit("50/minute")
async def get_user_credits(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's credit balance and subscription info"""
    
    user_id = current_user["id"]
    
    try:
        profile = await get_or_create_user_profile(user_id)
        
        return UserCreditsResponse(
            credits=profile.get("credits", 0),
            plan_type=profile.get("plan_type", "free"),
            status=profile.get("status", "active")
        )
        
    except Exception as e:
        logger.error(f"Error getting user credits: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving user credits"
        )

@router.get("/subscription-status", response_model=SubscriptionStatusResponse)
@limiter.limit("50/minute")
async def get_subscription_status(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get user's subscription details from database"""
    
    user_id = current_user["id"]
    
    try:
        profile = await get_or_create_user_profile(user_id)
        
        return SubscriptionStatusResponse(
            plan_type=profile.get("plan_type", "free"),
            status=profile.get("status", "active"),
            stripe_customer_id=profile.get("stripe_customer_id"),
            stripe_subscription_id=profile.get("stripe_subscription_id"),
            current_period_start=None,  # Not stored in database
            current_period_end=None,    # Not stored in database
            next_billing_date=None      # Not stored in database
        )
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving subscription status"
        )


@router.get("/user-profile", response_model=UserProfileResponse)
@limiter.limit("50/minute")
async def get_user_profile(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get user's profile information"""
    
    user_id = current_user["id"]
    email = current_user.get("email")
    
    try:
        profile = await get_or_create_user_profile(user_id)
        
        return UserProfileResponse(
            user_id=user_id,
            name=profile.get("name"),
            email=email,
            credits=profile.get("credits", 0),
            plan_type=profile.get("plan_type", "free"),
            status=profile.get("status", "active"),
            stripe_customer_id=profile.get("stripe_customer_id")
        )
        
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving user profile"
        )


@router.patch("/user-profile", response_model=UserProfileResponse)
@limiter.limit("20/minute")
async def update_user_profile(
    request: Request,
    update_data: UpdateUserProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update user's profile information"""
    
    user_id = current_user["id"]
    email = current_user.get("email")
    
    try:
        # Get existing profile
        profile = await get_or_create_user_profile(user_id)
        
        # Update only provided fields
        update_fields = {}
        if update_data.name is not None:
            update_fields["name"] = update_data.name
        
        if update_fields:
            update_fields["updated_at"] = "now()"
            supabase.table("user_profiles").update(update_fields).eq("user_id", user_id).execute()
            
            # Refresh profile data
            profile = await get_or_create_user_profile(user_id)
        
        return UserProfileResponse(
            user_id=user_id,
            name=profile.get("name"),
            email=email,
            credits=profile.get("credits", 0),
            plan_type=profile.get("plan_type", "free"),
            status=profile.get("status", "active"),
            stripe_customer_id=profile.get("stripe_customer_id")
        )
        
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while updating user profile"
        )


@router.post("/create-checkout-session")
@limiter.limit("10/minute")
async def create_checkout_session(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe checkout session for subscription"""
    
    user_id = current_user["id"]
    
    try:
        # Get request body
        body = await request.json()
        plan_id = body.get("plan_id")
        
        if not plan_id or plan_id not in SUBSCRIPTION_PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan ID")
        
        plan = SUBSCRIPTION_PLANS[plan_id]
        price_id = plan.get("price_id")
        
        if not price_id:
            raise HTTPException(status_code=400, detail="Plan does not have a price ID configured")
        
        # Get or create user profile
        profile = await get_or_create_user_profile(user_id)
        
        # Get or create Stripe customer
        customer_id = profile.get("stripe_customer_id")
        if not customer_id:
            # Create new Stripe customer
            customer_email = current_user.get("email")
            customer = stripe.Customer.create(
                email=customer_email,
                metadata={"user_id": user_id}
            )
            customer_id = customer.id
            
            # Update user profile with customer_id
            await get_or_create_user_profile(user_id, customer_id)
        
        # Create checkout session
        success_url = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/app/billing?session_id={CHECKOUT_SESSION_ID}"
        cancel_url = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/app/billing"
        
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "plan_id": plan_id
            },
            subscription_data={
                "metadata": {
                    "user_id": user_id,
                    "plan_id": plan_id
                }
            }
        )
        
        logger.info(f"Created checkout session {checkout_session.id} for user {user_id}, plan {plan_id}")
        
        return {
            "sessionId": checkout_session.id,
            "url": checkout_session.url
        }
        
    except stripe.StripeError as e:
        logger.error(f"Stripe error creating checkout session: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-customer-subscription")
@limiter.limit("10/minute")
async def sync_customer_subscription(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Manually sync customer's subscription status from Stripe"""
    
    user_id = current_user["id"]
    
    try:
        # Get user profile
        profile = await get_or_create_user_profile(user_id)
        customer_id = profile.get("stripe_customer_id")
        
        if not customer_id:
            raise HTTPException(status_code=400, detail="No Stripe customer ID found for user")
        
        # Get customer's subscriptions from Stripe
        subscriptions = stripe.Subscription.list(customer=customer_id, status='active')
        
        if not subscriptions.data:
            # No active subscriptions
            await update_subscription_status(user_id, "free", "cancelled", customer_id, None)
            return {
                "status": "success",
                "message": "No active subscriptions found. Set to free plan.",
                "plan_type": "free",
                "status": "cancelled"
            }
        
        # Get the first active subscription
        subscription = subscriptions.data[0]
        subscription_id = subscription.id
        price_id = subscription["items"]["data"][0]["price"]["id"]
        
        # Find plan by price_id
        plan_type = "free"
        for plan, details in SUBSCRIPTION_PLANS.items():
            if details["price_id"] == price_id:
                plan_type = plan
                break
        
        # Update subscription status
        await update_subscription_status(
            user_id, plan_type, "active", customer_id, subscription_id
        )
        
        # Add credits if this is a new subscription
        if profile.get("plan_type") != plan_type:
            credits = SUBSCRIPTION_PLANS[plan_type]["credits"]
            await add_credits_to_user(user_id, credits, "subscription_sync")
        
        return {
            "status": "success",
            "message": f"Synced subscription: {plan_type} - active",
            "plan_type": plan_type,
            "status": "active",
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id
        }
        
    except stripe.StripeError as e:
        logger.error(f"Stripe error syncing subscription: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error syncing subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


