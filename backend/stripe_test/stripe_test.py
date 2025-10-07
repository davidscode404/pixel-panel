from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import stripe
import os
import logging
import json
from typing import Optional, Dict, Any
from auth_shared import get_current_user
from services.user_credits import UserCreditsService
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client

logger = logging.getLogger(__name__)

# Initialize Stripe with TEST keys
stripe.api_key = os.getenv("STRIPE_TEST_SECRET_KEY", "sk_test_your_test_key_here")

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')  # Use service key for admin operations
supabase = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/api/stripe", tags=["stripe"])
limiter = Limiter(key_func=get_remote_address)

# Test Subscription Plans Configuration (using test price IDs)
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
        "price_id": "price_test_starter_123",  # Test price ID
        "features": ["High-quality generation", "Priority support"]
    },
    "pro": {
        "name": "Pro",
        "price": 999,  # $9.99 in cents
        "credits": 1200,
        "price_id": "price_test_pro_123",  # Test price ID
        "features": ["Premium features", "Advanced voice", "Custom training"]
    },
    "creator": {
        "name": "Creator",
        "price": 1999,  # $19.99 in cents
        "credits": 2800,
        "price_id": "price_test_creator_123",  # Test price ID
        "features": ["All Pro features", "Enhanced capabilities"]
    },
    "content_machine": {
        "name": "Content Machine",
        "price": 4999,  # $49.99 in cents
        "credits": 8000,
        "price_id": "price_test_content_machine_123",  # Test price ID
        "features": ["Maximum credits", "All premium features"]
    }
}


# Request/Response Models
class CheckoutSessionRequest(BaseModel):
    price_id: str
    success_url: str
    cancel_url: str

class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


class CustomerPortalRequest(BaseModel):
    return_url: str

class CustomerPortalResponse(BaseModel):
    url: str

class UserCreditsResponse(BaseModel):
    credits: int
    plan_type: str
    status: str

class SubscriptionStatusResponse(BaseModel):
    plan_type: str
    status: str
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]

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

@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
@limiter.limit("10/minute")
async def create_checkout_session(
    request: Request,
    checkout_request: CheckoutSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe Checkout Session for subscription"""
    
    user_id = current_user["id"]
    
    try:
        # Get or create user profile
        profile = await get_or_create_user_profile(user_id)
        
        # Create or get Stripe customer
        if profile.get("stripe_customer_id"):
            customer_id = profile["stripe_customer_id"]
        else:
            customer = stripe.Customer.create(
                email=current_user.get("email"),
                metadata={"user_id": user_id}
            )
            customer_id = customer.id
            
            # Update profile with customer ID
            supabase.table("user_profiles").update({
                "stripe_customer_id": customer_id,
                "updated_at": "now()"
            }).eq("user_id", user_id).execute()
        
        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            success_url=checkout_request.success_url,
            cancel_url=checkout_request.cancel_url,
            mode='subscription',
            line_items=[{
                'price': checkout_request.price_id,
                'quantity': 1
            }],
            subscription_data={
                'billing_mode': {
                    'type': 'flexible'
                }
            },
            metadata={
                "user_id": user_id
            }
        )
        
        return CheckoutSessionResponse(
            session_id=session.id,
            url=session.url
        )
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout session: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/webhook")
@limiter.limit("100/minute")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for subscription and payment events"""
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    logger.info(f"TEST WEBHOOK received - Headers: {dict(request.headers)}")
    logger.info(f"TEST WEBHOOK payload length: {len(payload)}")
    
    # Use test webhook secret
    webhook_secret = os.getenv("ENDPOINT_SECRET", "whsec_test_secret_123")
    if not webhook_secret:
        logger.error("ENDPOINT_SECRET environment variable not set")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        logger.info(f"TEST WEBHOOK signature verified successfully")
    except ValueError as e:
        logger.error(f"Invalid payload in webhook: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature in webhook: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    data = event["data"]["object"]
    
    logger.info(f"TEST WEBHOOK Processing event: {event_type}")
    logger.info(f"TEST WEBHOOK Event data: {json.dumps(data, indent=2)}")
    
    try:
        if event_type == "checkout.session.completed":
            logger.info("TEST WEBHOOK Handling checkout.session.completed")
            await handle_checkout_session_completed(data)
        elif event_type == "customer.subscription.created":
            logger.info("TEST WEBHOOK Handling customer.subscription.created")
            await handle_subscription_created(data)
        elif event_type == "customer.subscription.updated":
            logger.info("TEST WEBHOOK Handling customer.subscription.updated")
            await handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            logger.info("TEST WEBHOOK Handling customer.subscription.deleted")
            await handle_subscription_deleted(data)
        elif event_type == "invoice.payment_succeeded":
            logger.info("TEST WEBHOOK Handling invoice.payment_succeeded")
            logger.info(f"TEST WEBHOOK About to call handle_invoice_payment_succeeded with data: {data}")
            await handle_invoice_payment_succeeded(data)
            logger.info("TEST WEBHOOK handle_invoice_payment_succeeded completed")
        elif event_type == "invoice.payment_failed":
            logger.info("TEST WEBHOOK Handling invoice.payment_failed")
            await handle_invoice_payment_failed(data)
        else:
            logger.info(f"TEST WEBHOOK Unhandled event type: {event_type}")
    
    except Exception as e:
        logger.error(f"TEST WEBHOOK Error processing event {event_type}: {e}")
        logger.error(f"TEST WEBHOOK Exception details: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"TEST WEBHOOK Traceback: {traceback.format_exc()}")
        # Don't raise exception to avoid webhook retries for non-critical errors
    
    logger.info(f"TEST WEBHOOK Event {event_type} processed successfully")
    return {"status": "success", "test_mode": True}

async def handle_checkout_session_completed(session_data):
    """Handle successful checkout session completion"""
    logger.info(f"TEST handle_checkout_session_completed called with data: {session_data}")
    
    customer_id = session_data.get("customer")
    subscription_id = session_data.get("subscription")
    user_id = session_data.get("metadata", {}).get("user_id")
    
    logger.info(f"TEST Extracted: customer_id={customer_id}, subscription_id={subscription_id}, user_id={user_id}")
    
    if not user_id:
        logger.warning("TEST No user_id in checkout session metadata")
        return
    
    # Get subscription details
    if subscription_id:
        logger.info(f"TEST Retrieving subscription {subscription_id}")
        subscription = stripe.Subscription.retrieve(subscription_id)
        price_id = subscription["items"]["data"][0]["price"]["id"]
        logger.info(f"TEST Found price_id: {price_id}")
        
        # Find plan by price_id
        plan_type = "free"
        for plan, details in SUBSCRIPTION_PLANS.items():
            if details["price_id"] == price_id:
                plan_type = plan
                break
        
        logger.info(f"TEST Determined plan_type: {plan_type}")
        
        # Update user profile
        logger.info(f"TEST Updating subscription status for user {user_id}")
        await update_subscription_status(
            user_id, plan_type, "active", customer_id, subscription_id
        )
        
        # Add initial credits
        credits = SUBSCRIPTION_PLANS[plan_type]["credits"]
        logger.info(f"TEST Adding {credits} credits to user {user_id}")
        await add_credits_to_user(user_id, credits, "subscription_created")
        
        logger.info(f"TEST Checkout completed: User {user_id} subscribed to {plan_type}")
    else:
        logger.warning("TEST No subscription_id in checkout session")

async def handle_subscription_created(subscription_data):
    """Handle new subscription creation"""
    logger.info(f"TEST handle_subscription_created called with data: {subscription_data}")
    
    customer_id = subscription_data.get("customer")
    subscription_id = subscription_data.get("id")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"TEST No user found for customer {customer_id}")
        # For test events, try to find any user and update them (this is just for testing)
        test_result = supabase.table("user_profiles").select("*").limit(1).execute()
        if test_result.data:
            user_id = test_result.data[0]["user_id"]
            logger.info(f"TEST Using test user {user_id} for subscription event")
        else:
            logger.warning("TEST No users found in database for test subscription")
            return
    else:
        user_id = result.data[0]["user_id"]
    
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
    
    logger.info(f"TEST Subscription created: User {user_id} subscribed to {plan_type}")

async def handle_subscription_updated(subscription_data):
    """Handle subscription updates (plan changes, status updates)"""
    logger.info(f"TEST handle_subscription_updated called with data: {subscription_data}")
    
    customer_id = subscription_data.get("customer")
    subscription_id = subscription_data.get("id")
    status = subscription_data.get("status")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"TEST No user found for customer {customer_id}")
        # For test events, try to find any user and update them (this is just for testing)
        test_result = supabase.table("user_profiles").select("*").limit(1).execute()
        if test_result.data:
            user_id = test_result.data[0]["user_id"]
            logger.info(f"TEST Using test user {user_id} for subscription update event")
        else:
            logger.warning("TEST No users found in database for test subscription update")
            return
    else:
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
    
    logger.info(f"TEST Subscription updated: User {user_id} - {plan_type} - {status}")

async def handle_subscription_deleted(subscription_data):
    """Handle subscription cancellation"""
    logger.info(f"TEST handle_subscription_deleted called with data: {subscription_data}")
    
    customer_id = subscription_data.get("customer")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"TEST No user found for customer {customer_id}")
        return
    
    user_id = result.data[0]["user_id"]
    
    # Mark subscription as cancelled (user keeps all credits)
    await update_subscription_status(
        user_id, "free", "cancelled", customer_id, None
    )
    
    logger.info(f"TEST Subscription cancelled: User {user_id}")

async def handle_invoice_payment_succeeded(invoice_data):
    """Handle successful monthly subscription payments"""
    logger.info(f"TEST handle_invoice_payment_succeeded called with data: {invoice_data}")
    
    customer_id = invoice_data.get("customer")
    subscription_id = invoice_data.get("subscription")
    
    if not subscription_id:
        logger.info("TEST No subscription_id in invoice - not a subscription invoice")
        return  # Not a subscription invoice
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"TEST No user found for customer {customer_id}")
        # Try to find user by checking if they have this customer_id in their profile
        all_users = supabase.table("user_profiles").select("*").execute()
        logger.info(f"TEST Found {len(all_users.data)} total users in database")
        for user in all_users.data:
            logger.info(f"TEST User {user['user_id']} has customer_id: {user.get('stripe_customer_id')}")
        
        # For testing: if no user found, try to get customer details from Stripe and match by email
        try:
            customer = stripe.Customer.retrieve(customer_id)
            customer_email = customer.get("email")
            logger.info(f"TEST Customer {customer_id} has email: {customer_email}")
            
            if customer_email:
                # Try to find user by email in auth.users (this would require a different approach)
                # For now, let's update the first user we find (for testing purposes)
                if all_users.data:
                    user_id = all_users.data[0]["user_id"]
                    logger.info(f"TEST Updating user {user_id} with customer_id {customer_id}")
                    
                    # Update user profile with customer ID
                    supabase.table("user_profiles").update({
                        "stripe_customer_id": customer_id,
                        "updated_at": "now()"
                    }).eq("user_id", user_id).execute()
                    
                    # Continue with the rest of the function
                    result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
                    if result.data:
                        logger.info(f"TEST Successfully updated user {user_id} with customer_id")
                    else:
                        logger.error(f"TEST Failed to update user {user_id}")
                        return
                else:
                    logger.warning("TEST No users found in database to update")
                    return
            else:
                logger.warning("TEST Customer has no email, cannot match to user")
                return
        except Exception as e:
            logger.error(f"TEST Error retrieving customer details: {e}")
            return
    
    user_id = result.data[0]["user_id"]
    logger.info(f"TEST Found user {user_id} for customer {customer_id}")
    
    # Get subscription details
    subscription = stripe.Subscription.retrieve(subscription_id)
    price_id = subscription["items"]["data"][0]["price"]["id"]
    logger.info(f"TEST Subscription price_id: {price_id}")
    
    # Find plan by price_id
    plan_type = "free"
    for plan, details in SUBSCRIPTION_PLANS.items():
        if details["price_id"] == price_id:
            plan_type = plan
            break
    
    logger.info(f"TEST Determined plan_type: {plan_type}")
    
    # Update subscription status
    await update_subscription_status(
        user_id, plan_type, "active", customer_id, subscription_id
    )
    
    # Add monthly credits (additive approach)
    credits = SUBSCRIPTION_PLANS[plan_type]["credits"]
    await add_credits_to_user(user_id, credits, "monthly_renewal")
    
    logger.info(f"TEST Monthly renewal: User {user_id} received {credits} credits for {plan_type}")

async def handle_invoice_payment_failed(invoice_data):
    """Handle failed subscription payments"""
    logger.info(f"TEST handle_invoice_payment_failed called with data: {invoice_data}")
    
    customer_id = invoice_data.get("customer")
    
    # Find user by customer_id
    result = supabase.table("user_profiles").select("*").eq("stripe_customer_id", customer_id).execute()
    
    if not result.data:
        logger.warning(f"TEST No user found for customer {customer_id}")
        return
    
    user_id = result.data[0]["user_id"]
    
    # Update subscription status to past_due
    await update_subscription_status(
        user_id, result.data[0]["plan_type"], "past_due", customer_id, None
    )
    
    logger.warning(f"TEST Payment failed: User {user_id} subscription is past due")


@router.post("/create-customer-portal-session", response_model=CustomerPortalResponse)
@limiter.limit("10/minute")
async def create_customer_portal_session(
    request: Request,
    portal_request: CustomerPortalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a customer portal session for subscription management"""
    
    user_id = current_user["id"]
    
    try:
        # Get user profile
        profile = await get_or_create_user_profile(user_id)
        customer_id = profile.get("stripe_customer_id")
        
        if not customer_id:
            raise HTTPException(status_code=400, detail="No Stripe customer found")
        
        # Create portal session
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=portal_request.return_url
        )
        
        return CustomerPortalResponse(url=session.url)
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating portal session: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating portal session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

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
    """Get user's subscription details"""
    
    user_id = current_user["id"]
    
    try:
        profile = await get_or_create_user_profile(user_id)
        
        return SubscriptionStatusResponse(
            plan_type=profile.get("plan_type", "free"),
            status=profile.get("status", "active"),
            stripe_customer_id=profile.get("stripe_customer_id"),
            stripe_subscription_id=profile.get("stripe_subscription_id")
        )
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving subscription status"
        )

@router.get("/plans")
@limiter.limit("50/minute")
async def get_subscription_plans(request: Request):
    """Get available subscription plans"""
    
    return {
        "plans": SUBSCRIPTION_PLANS,
        "test_mode": True
    }

@router.get("/test-database")
@limiter.limit("10/minute")
async def test_database_connection(request: Request):
    """Test database connection and operations"""
    
    try:
        # Test basic connection
        result = supabase.table("user_profiles").select("count").execute()
        logger.info(f"Database connection test successful: {result}")
        
        # Test creating a test user profile
        test_user_id = "test-user-db-connection"
        test_profile = {
            "user_id": test_user_id,
            "credits": 100,
            "stripe_customer_id": "cus_test_123",
            "plan_type": "free",
            "status": "active"
        }
        
        # Try to insert (might fail due to foreign key constraint, that's ok)
        try:
            insert_result = supabase.table("user_profiles").insert(test_profile).execute()
            logger.info(f"Test profile created: {insert_result}")
        except Exception as insert_error:
            logger.warning(f"Could not create test profile (expected if user doesn't exist in auth.users): {insert_error}")
        
        # Test querying
        query_result = supabase.table("user_profiles").select("*").limit(5).execute()
        logger.info(f"Query test successful: {len(query_result.data)} profiles found")
        
        return {
            "status": "success",
            "message": "Database connection and operations working",
            "test_mode": True,
            "profiles_count": len(query_result.data),
            "sample_profiles": query_result.data[:3] if query_result.data else []
        }
        
    except Exception as e:
        logger.error(f"Database test failed: {e}")
        return {
            "status": "error",
            "message": f"Database test failed: {str(e)}",
            "test_mode": True
        }

@router.post("/test-update-subscription")
@limiter.limit("10/minute")
async def test_update_subscription(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Test endpoint to manually update user subscription status"""
    
    user_id = current_user["id"]
    
    try:
        # Update user with test subscription data
        await update_subscription_status(
            user_id, "starter", "active", "cus_test_customer", "sub_test_subscription"
        )
        
        # Add test credits
        await add_credits_to_user(user_id, 500, "test_update")
        
        return {
            "status": "success",
            "message": f"Updated user {user_id} with starter plan and 500 credits"
        }
        
    except Exception as e:
        logger.error(f"Error in test update: {e}")
        raise HTTPException(status_code=500, detail=str(e))
