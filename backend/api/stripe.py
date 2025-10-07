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
from supabase import create_client

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')
supabase = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/api/stripe", tags=["stripe"])
limiter = Limiter(key_func=get_remote_address)

# Credit packages configuration
CREDIT_PACKAGES = {
    "credits_500": {"price": 499, "credits": 500},    # $4.99 in cents - Starter
    "credits_1200": {"price": 999, "credits": 1200},  # $9.99 in cents - Pro
    "credits_2800": {"price": 1999, "credits": 2800}, # $19.99 in cents - Creator
    "credits_8000": {"price": 4999, "credits": 8000}, # $49.99 in cents - Content Machine
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
    
    # Handle Stripe Checkout completion
    elif event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        
        # Handle direct Stripe checkout completion
        customer_email = session.get("customer_email")
        customer_id = session.get("customer")  # Get customer ID from session
        session_id = session.get("id")
        
        # Map amounts to credits based on your pricing
        amount_total = session.get("amount_total", 0)
        amount_in_cents = amount_total / 100  # Convert from cents to dollars
        
        amount_to_credits = {
            4.99: 500,   # Starter plan: $4.99 → 500 credits
            9.99: 1200,  # Pro plan: $9.99 → 1200 credits
            19.99: 2800, # Creator plan: $19.99 → 2800 credits
            49.99: 8000, # Content Machine plan: $49.99 → 8000 credits
        }
        
        credits = amount_to_credits.get(amount_in_cents, 500)  # Default to 500 credits
        
        logger.info(f"Checkout completed: {customer_email} purchased {credits} credits for ${amount_in_cents} via direct checkout (Session: {session_id})")
        
        # Find user by customer_id only, create new user if not found
        user_id = None
        if customer_id:
            user_id = await find_user_by_customer_id(customer_id)
        
        # If not found, create new user (for new customers who paid but don't have accounts)
        if not user_id and customer_email and customer_id:
            logger.info(f"Creating new user for customer {customer_id} with email {customer_email}")
            user_id = await create_user_for_customer(customer_id, customer_email)
        
        if user_id:
            # Add credits to the user's account
            try:
                credits_service = UserCreditsService()
                new_balance = await credits_service.add_credits(user_id, credits)
                logger.info(f"Successfully added {credits} credits to user {user_id} (email: {customer_email}). New balance: {new_balance}")
            except Exception as e:
                logger.error(f"Error adding credits to user {user_id}: {e}")
        else:
            logger.warning(f"User not found for customer_id: {customer_id}. Credits not added.")
            # Log the purchase details for manual processing if needed
            logger.info(f"Manual processing needed: {customer_email} - {credits} credits - ${amount_in_cents} - customer_id: {customer_id}")
    
    # Handle subscription events for recurring billing
    elif event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        await handle_subscription_created(subscription)
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        await handle_subscription_updated(subscription)
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_deleted(subscription)
    
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        await handle_invoice_payment_succeeded(invoice)
    
    return {"status": "success"}

# Helper functions - Customer ID only, no email lookup
async def find_user_by_customer_id(customer_id: str) -> str:
    """
    Find user_id by Stripe customer_id only
    
    Args:
        customer_id: Stripe customer ID
        
    Returns:
        user_id if found, None otherwise
    """
    try:
        profile_result = supabase.table('user_profiles').select('user_id').eq('stripe_customer_id', customer_id).execute()
        if profile_result.data and len(profile_result.data) > 0:
            user_id = profile_result.data[0]['user_id']
            logger.info(f"Found existing user {user_id} by stripe_customer_id {customer_id}")
            return user_id
    except Exception as e:
        logger.warning(f"Error looking up user by stripe_customer_id: {e}")
    
    logger.warning(f"User not found for customer_id {customer_id}")
    return None

async def create_user_for_customer(customer_id: str, customer_email: str) -> str:
    """
    Create a new user for a Stripe customer who doesn't exist in our system
    
    Args:
        customer_id: Stripe customer ID
        customer_email: Customer email address
        
    Returns:
        user_id if created successfully, None otherwise
    """
    try:
        # Create user in Supabase auth
        auth_response = supabase.auth.admin.create_user({
            "email": customer_email,
            "email_confirm": True,  # Auto-confirm since they paid
            "user_metadata": {
                "stripe_customer_id": customer_id,
                "created_via_stripe": True
            }
        })
        
        if auth_response.user:
            user_id = auth_response.user.id
            logger.info(f"Created new user {user_id} for Stripe customer {customer_id}")
            
            # Create user profile with initial data
            try:
                supabase.table('user_profiles').insert({
                    'user_id': user_id,
                    'stripe_customer_id': customer_id,
                    'credits': 0,  # Will be updated by the webhook
                    'created_at': 'now()',
                    'updated_at': 'now()'
                }).execute()
                logger.info(f"Created user profile for new user {user_id}")
                return user_id
            except Exception as e:
                logger.error(f"Error creating user profile for {user_id}: {e}")
                return None
        else:
            logger.error(f"Failed to create user for customer {customer_id}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating user for customer {customer_id}: {e}")
        return None

async def handle_credit_rollover(user_id: str, new_plan_credits: int, previous_plan_credits: int = None) -> int:
    """
    Handle credit rollover logic for subscription renewals and upgrades
    Simple additive approach - users keep all existing credits
    
    Args:
        user_id: User ID
        new_plan_credits: Credits for the new/current plan
        previous_plan_credits: Credits for the previous plan (for upgrades, unused)
        
    Returns:
        Total credits after rollover
    """
    try:
        credits_service = UserCreditsService()
        
        # Simply add new plan credits to existing balance (no limits, no complex logic)
        new_balance = await credits_service.add_credits(user_id, new_plan_credits)
        
        logger.info(f"Credit rollover for user {user_id}: Added {new_plan_credits} new credits, total balance: {new_balance}")
        
        return new_balance
        
    except Exception as e:
        logger.error(f"Error handling credit rollover for user {user_id}: {e}")
        # Fallback to simple credit addition
        credits_service = UserCreditsService()
        return await credits_service.add_credits(user_id, new_plan_credits)

async def handle_subscription_created(subscription):
    """Handle new subscription creation"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    status = subscription.get('status')
    
    logger.info(f"New subscription created: {subscription_id} for customer {customer_id}, status: {status}")
    
    try:
        # Find user by customer_id only
        user_id = await find_user_by_customer_id(customer_id)
        
        # If not found, try to create new user
        if not user_id:
            try:
                customer = stripe.Customer.retrieve(customer_id)
                customer_email = customer.email
                if customer_email:
                    logger.info(f"Creating new user for subscription customer {customer_id} with email {customer_email}")
                    user_id = await create_user_for_customer(customer_id, customer_email)
            except Exception as e:
                logger.error(f"Error creating user for subscription customer {customer_id}: {e}")
        
        if user_id:
            # Determine credits based on subscription price
            items = subscription.get('items', {}).get('data', [])
            if items:
                price_id = items[0].get('price', {}).get('id')
                price = stripe.Price.retrieve(price_id)
                amount = price.unit_amount / 100  # Convert from cents
                
                # Map amount to credits
                amount_to_credits = {
                    4.99: 500,   # Starter plan
                    9.99: 1200,  # Pro plan
                    19.99: 2800, # Creator plan
                    49.99: 8000, # Content Machine plan
                }
                
                credits = amount_to_credits.get(amount, 500)
                
                # Add credits to user account
                credits_service = UserCreditsService()
                new_balance = await credits_service.add_credits(user_id, credits)
                logger.info(f"Added {credits} credits for new subscription. User {user_id} now has {new_balance} credits")
                
                # Store subscription details in user_profiles table
                plan_type = "starter" if credits == 500 else "pro" if credits == 1200 else "creator" if credits == 2800 else "contentMachine"
                
                try:
                    # Update user profile with subscription data
                    supabase.table('user_profiles').update({
                        "stripe_subscription_id": subscription_id,
                        "stripe_customer_id": customer_id,
                        "plan_type": plan_type,
                        "status": status,
                        "updated_at": "now()"
                    }).eq('user_id', user_id).execute()
                    logger.info(f"Stored subscription data for user {user_id} in user_profiles")
                except Exception as e:
                    logger.error(f"Error storing subscription data: {e}")
            else:
                logger.warning(f"No items found in subscription {subscription_id}")
        else:
            logger.warning(f"User not found for customer_id: {customer_id}")
            
    except Exception as e:
        logger.error(f"Error handling subscription creation: {e}")

async def handle_subscription_updated(subscription):
    """Handle subscription updates (plan changes, status changes)"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    status = subscription.get('status')
    
    logger.info(f"Subscription updated: {subscription_id} for customer {customer_id}, status: {status}")
    
    try:
        # Update subscription status in user_profiles table
        try:
            supabase.table('user_profiles').update({
                "status": status,
                "updated_at": "now()"
            }).eq('stripe_subscription_id', subscription_id).execute()
            logger.info(f"Updated subscription status to {status} for subscription {subscription_id}")
        except Exception as e:
            logger.error(f"Error updating subscription status: {e}")
        
        # Handle plan changes if needed
        if status == 'active':
            items = subscription.get('items', {}).get('data', [])
            if items:
                price_id = items[0].get('price', {}).get('id')
                price = stripe.Price.retrieve(price_id)
                amount = price.unit_amount / 100
                
                # Map amount to credits
                amount_to_credits = {
                    4.99: 500,   # Starter plan
                    9.99: 1200,  # Pro plan
                    19.99: 2800, # Creator plan
                    49.99: 8000, # Content Machine plan
                }
                
                new_credits = amount_to_credits.get(amount, 500)
                
                # For plan changes, we don't add credits automatically
                # Credits are only added during subscription creation and monthly renewals
                logger.info(f"Plan updated to {new_credits} credits per month. No credits added during plan change.")
                
                # Update plan type in user_profiles table
                try:
                    supabase.table('user_profiles').update({
                        "plan_type": "starter" if new_credits == 500 else "pro" if new_credits == 1200 else "creator" if new_credits == 2800 else "contentMachine",
                        "updated_at": "now()"
                    }).eq('stripe_subscription_id', subscription_id).execute()
                    logger.info(f"Updated plan details for subscription {subscription_id}")
                except Exception as e:
                    logger.error(f"Error updating plan details: {e}")
        
    except Exception as e:
        logger.error(f"Error handling subscription update: {e}")

async def handle_subscription_deleted(subscription):
    """Handle subscription cancellation"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    
    logger.info(f"Subscription cancelled: {subscription_id} for customer {customer_id}")
    
    try:
        # Update subscription status in user_profiles table
        try:
            supabase.table('user_profiles').update({
                "status": "cancelled",
                "updated_at": "now()"
            }).eq('stripe_subscription_id', subscription_id).execute()
            logger.info(f"Marked subscription {subscription_id} as cancelled")
        except Exception as e:
            logger.error(f"Error updating subscription cancellation: {e}")
        
        # Users keep their existing credits - no credit modification needed
        
        # TODO: Send cancellation confirmation email if needed
        
    except Exception as e:
        logger.error(f"Error handling subscription cancellation: {e}")

async def handle_invoice_payment_succeeded(invoice):
    """Handle successful monthly invoice payments"""
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    amount_paid = invoice.get('amount_paid', 0) / 100  # Convert from cents
    
    logger.info(f"Invoice payment succeeded: ${amount_paid} for customer {customer_id}, subscription {subscription_id}")
    
    try:
        # Find user by customer_id only
        user_id = await find_user_by_customer_id(customer_id)
        
        if user_id and subscription_id:
            # Map amount to credits for monthly allocation
            amount_to_credits = {
                4.99: 500,   # Starter plan
                9.99: 1200,  # Pro plan
                19.99: 2800, # Creator plan
                49.99: 8000, # Content Machine plan
            }
            
            credits = amount_to_credits.get(amount_paid, 500)
            
            # Handle credit rollover for subscription renewal
            new_balance = await handle_credit_rollover(user_id, credits)
            logger.info(f"Processed subscription renewal with rollover. User {user_id} now has {new_balance} credits")
            
            # Update user profile with last payment info
            try:
                supabase.table('user_profiles').update({
                    "updated_at": "now()"
                }).eq('stripe_subscription_id', subscription_id).execute()
                logger.info(f"Updated user profile for subscription {subscription_id}")
            except Exception as e:
                logger.error(f"Error updating user profile: {e}")
        else:
            logger.warning(f"User not found for customer_id: {customer_id} or no subscription ID")
            
    except Exception as e:
        logger.error(f"Error handling invoice payment: {e}")

@router.get("/user-credits")
@limiter.limit("50/minute")
async def get_user_credits(request: Request, current_user: dict = Depends(get_current_user)):
    """Get the current user's credit balance"""
    try:
        credits_service = UserCreditsService()
        credits = await credits_service.get_user_credits(current_user["id"])
        return {"credits": credits}
    except Exception as e:
        logger.error(f"Error getting credits for user {current_user['id']}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve credits")

@router.get("/user-profile")
@limiter.limit("50/minute")
async def get_user_profile(request: Request, current_user: dict = Depends(get_current_user)):
    """Get the current user's profile information"""
    try:
        credits_service = UserCreditsService()
        credits = await credits_service.get_user_credits(current_user["id"])
        name = await credits_service.get_user_name(current_user["id"])
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

@router.get("/subscription-status")
@limiter.limit("50/minute")
async def get_subscription_status(request: Request, current_user: dict = Depends(get_current_user)):
    """Get the current user's subscription status"""
    try:
        logger.info(f"Getting subscription status for user: {current_user.get('email', 'Unknown')}")
        user_id = current_user.get("id")
        
        # Get current credits
        credits_service = UserCreditsService()
        current_credits = await credits_service.get_user_credits(user_id)
        
        # Get user's subscription plan from user_profiles table
        try:
            profile_result = supabase.table('user_profiles').select('plan_type, status').eq('user_id', user_id).execute()
            
            if profile_result.data and len(profile_result.data) > 0:
                user_profile = profile_result.data[0]
                plan = user_profile.get('plan_type', 'free')
                subscription_status = user_profile.get('status', 'inactive')
                
                # Only return the plan if subscription is active
                if subscription_status == 'active':
                    logger.info(f"User {user_id} has active subscription: {plan}")
                else:
                    plan = "free"
                    logger.info(f"User {user_id} subscription is {subscription_status}, defaulting to free")
            else:
                plan = "free"
                logger.info(f"No subscription found for user {user_id}, defaulting to free")
                
        except Exception as e:
            logger.error(f"Error checking subscription for user {user_id}: {e}")
            plan = "free"
        
        # Get user's email for Stripe customer lookup
        user_email = current_user.get("email", "")
        
        # Get subscription details from user profile
        subscription_id = None
        customer_id = None
        
        try:
            profile_result = supabase.table('user_profiles').select('stripe_subscription_id, stripe_customer_id').eq('user_id', user_id).execute()
            if profile_result.data and len(profile_result.data) > 0:
                subscription_id = profile_result.data[0].get('stripe_subscription_id')
                customer_id = profile_result.data[0].get('stripe_customer_id')
        except Exception as e:
            logger.error(f"Error getting subscription details: {e}")
        
        # Determine credits per month based on plan type
        plan_credits_map = {
            "free": 100,
            "starter": 500,
            "pro": 1200,
            "creator": 2800,
            "contentMachine": 8000
        }
        
        credits_per_month = plan_credits_map.get(plan, 100)
        
        return {
            "plan": plan,
            "status": "active" if plan != "free" else "inactive",
            "credits": current_credits,
            "credits_per_month": credits_per_month,
            "next_billing_date": None,  # Can be added later if needed
            "subscription_id": subscription_id,
            "customer_id": customer_id,
            "customer_email": user_email
        }
    except Exception as e:
        logger.error(f"Error fetching subscription status: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscription status")

@router.post("/cancel-subscription")
@limiter.limit("10/minute")
async def cancel_subscription(
    request: Request, 
    current_user: dict = Depends(get_current_user)
):
    """Cancel the user's subscription"""
    try:
        # Mock cancellation - in real implementation, you'd call Stripe API
        logger.info(f"Cancelling subscription for user: {current_user['id']}")
        
        # Here you would:
        # 1. Get the customer's subscription ID from your database
        # 2. Call stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        # 3. Update your database with the cancellation
        
        return {
            "status": "success",
            "message": "Subscription will be cancelled at the end of the current billing period"
        }
    except Exception as e:
        logger.error(f"Error cancelling subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

@router.post("/update-subscription")
@limiter.limit("10/minute")
async def update_subscription(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Update the user's subscription plan"""
    try:
        # Get request body
        body = await request.json()
        new_plan_id = body.get("plan_id")
        
        if not new_plan_id:
            raise HTTPException(status_code=400, detail="plan_id is required")
        
        # Map plan IDs to Stripe price IDs (you'll need to set these up in Stripe)
        plan_to_price_map = {
            "starter": "price_starter_id",  # Replace with actual Stripe price IDs
            "pro": "price_pro_id",
            "creator": "price_creator_id",
            "contentMachine": "price_content_machine_id"
        }
        
        if new_plan_id not in plan_to_price_map:
            raise HTTPException(status_code=400, detail="Invalid plan ID")
        
        logger.info(f"Updating subscription for user {current_user['id']} to plan {new_plan_id}")
        
        # Here you would:
        # 1. Get the customer's subscription ID from your database
        # 2. Call stripe.Subscription.modify(subscription_id, items=[{"price": new_price_id}])
        # 3. Update your database with the new plan
        # 4. IMPORTANT: Do NOT modify user credits - they keep existing credits when downgrading/upgrading
        
        return {
            "status": "success",
            "message": f"Subscription updated to {new_plan_id} plan. Your existing credits are preserved."
        }
    except Exception as e:
        logger.error(f"Error updating subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")

@router.get("/subscription-portal")
@limiter.limit("10/minute")
async def create_subscription_portal(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe Customer Portal session for subscription management"""
    try:
        # In a real implementation, you'd:
        # 1. Get or create a Stripe customer ID for the user
        # 2. Create a customer portal session
        # 3. Return the portal URL
        
        logger.info(f"Creating subscription portal for user: {current_user['id']}")
        
        # Mock portal URL - replace with actual Stripe portal creation
        portal_url = "https://billing.stripe.com/p/login/test_portal_url"
        
        return {
            "status": "success",
            "portal_url": portal_url
        }
    except Exception as e:
        logger.error(f"Error creating subscription portal: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription portal")

@router.get("/webhook-test")
async def webhook_test():
    """Test endpoint to verify webhook configuration"""
    return {
        "status": "success",
        "message": "Webhook endpoint is working",
        "webhook_url": "https://pixelpanel.onrender.com/api/stripe/webhook",
        "environment_variables": {
            "stripe_secret_key": "✅ Set" if os.getenv("STRIPE_SECRET_KEY") else "❌ Missing",
            "stripe_webhook_secret": "✅ Set" if os.getenv("STRIPE_WEBHOOK_SECRET") else "❌ Missing",
            "supabase_url": "✅ Set" if os.getenv("SUPABASE_URL") else "❌ Missing",
            "supabase_anon_key": "✅ Set" if os.getenv("SUPABASE_ANON_KEY") else "❌ Missing",
        },
        "supported_events": [
            "payment_intent.succeeded",
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated", 
            "customer.subscription.deleted"
        ]
    }

@router.get("/auth-test")
async def auth_test(request: Request, current_user: dict = Depends(get_current_user)):
    """Test endpoint to verify authentication is working"""
    return {
        "status": "success",
        "message": "Authentication is working",
        "user": {
            "id": current_user.get("id"),
            "email": current_user.get("email"),
            "has_metadata": bool(current_user.get("user_metadata"))
        }
    }

@router.get("/subscription-status-public")
async def get_subscription_status_public():
    """Public test endpoint to verify subscription status logic works"""
    return {
        "status": "success",
        "message": "This is a public test endpoint",
        "test_plan": "free",
        "test_credits": 100,
        "note": "Use /subscription-status with authentication for real data"
    }
