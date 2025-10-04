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
    "credits_50": {"price": 499, "credits": 50},    # $4.99 in cents - Starter
    "credits_120": {"price": 999, "credits": 120},  # $9.99 in cents - Pro
    "credits_280": {"price": 1999, "credits": 280}, # $19.99 in cents - Creator
    "credits_800": {"price": 4999, "credits": 800}, # $49.99 in cents - Content Machine
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
        session_id = session.get("id")
        
        # Map checkout session URLs to credit amounts based on your Stripe links
        checkout_url_to_credits = {
            "https://buy.stripe.com/8x2aER4m93o2cWX8Om0Jq00": 50,   # Starter plan
            "https://buy.stripe.com/bJe14h6uh5wa0ab2pY0Jq01": 120,  # Pro plan
            "https://buy.stripe.com/eVqdR3cSFbUycWX6Ge0Jq04": 280,  # Creator plan
            "https://buy.stripe.com/8x26oBaKx1fU4qrd4C0Jq03": 800,  # Content Machine plan
        }
        
        # Try to get the checkout URL from the session metadata or use a default
        # Since we can't easily get the URL from the session, we'll use the amount to determine credits
        amount_total = session.get("amount_total", 0)
        amount_in_cents = amount_total / 100  # Convert from cents to dollars
        
        # Map amounts to credits based on your pricing
        amount_to_credits = {
            4.99: 50,   # Starter plan: $4.99 → 50 credits
            9.99: 120,  # Pro plan: $9.99 → 120 credits
            19.99: 280, # Creator plan: $19.99 → 280 credits
            49.99: 800, # Content Machine plan: $49.99 → 800 credits
        }
        
        credits = amount_to_credits.get(amount_in_cents, 50)  # Default to 50 credits
        
        logger.info(f"Checkout completed: {customer_email} purchased {credits} credits for ${amount_in_cents} via direct checkout (Session: {session_id})")
        
        # Try to find user by email and add credits
        if customer_email:
            try:
                # Import Supabase client to find user by email
                from supabase import create_client
                supabase_url = os.getenv('SUPABASE_URL')
                supabase_key = os.getenv('SUPABASE_ANON_KEY')
                
                if supabase_url and supabase_key:
                    supabase = create_client(supabase_url, supabase_key)
                    
                    # Find user by email in Supabase auth
                    auth_response = supabase.auth.admin.list_users()
                    user_id = None
                    
                    for user in auth_response:
                        if user.email == customer_email:
                            user_id = user.id
                            break
                    
                    if user_id:
                        # Add credits to the user's account
                        credits_service = UserCreditsService()
                        new_balance = await credits_service.add_credits(user_id, credits)
                        logger.info(f"Successfully added {credits} credits to user {user_id} (email: {customer_email}). New balance: {new_balance}")
                        
                        # Credits have been successfully added to user account
                    else:
                        logger.warning(f"User not found for email: {customer_email}. Credits not added.")
                        
                        # Optionally, you could store the purchase for later processing
                        # or send an email to the customer with instructions
                        
            except Exception as e:
                logger.error(f"Error processing checkout for {customer_email}: {e}")
                # Log the purchase details for manual processing if needed
                logger.info(f"Manual processing needed: {customer_email} - {credits} credits - ${amount_in_cents}")
    
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

async def handle_subscription_created(subscription):
    """Handle new subscription creation"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    status = subscription.get('status')
    
    logger.info(f"New subscription created: {subscription_id} for customer {customer_id}, status: {status}")
    
    try:
        # Get customer details from Stripe
        customer = stripe.Customer.retrieve(customer_id)
        customer_email = customer.email
        
        # Find user by email
        auth_response = supabase.auth.admin.list_users()
        user_id = None
        
        for user in auth_response:
            if user.email == customer_email:
                user_id = user.id
                break
        
        if user_id:
            # Determine credits based on subscription price
            items = subscription.get('items', {}).get('data', [])
            if items:
                price_id = items[0].get('price', {}).get('id')
                price = stripe.Price.retrieve(price_id)
                amount = price.unit_amount / 100  # Convert from cents
                
                # Map amount to credits
                amount_to_credits = {
                    4.99: 50,   # Starter plan
                    9.99: 120,  # Pro plan
                    19.99: 280, # Creator plan
                    49.99: 800, # Content Machine plan
                }
                
                credits = amount_to_credits.get(amount, 50)
                
                # Add credits to user account
                credits_service = UserCreditsService()
                new_balance = await credits_service.add_credits(user_id, credits)
                logger.info(f"Added {credits} credits for new subscription. User {user_id} now has {new_balance} credits")
                
                # Store subscription details in user_profiles table
                plan_type = "starter" if credits == 50 else "pro" if credits == 120 else "creator" if credits == 280 else "contentMachine"
                
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
            logger.warning(f"User not found for email: {customer_email}")
            
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
                    4.99: 50,   # Starter plan
                    9.99: 120,  # Pro plan
                    19.99: 280, # Creator plan
                    49.99: 800, # Content Machine plan
                }
                
                credits = amount_to_credits.get(amount, 50)
                
                # Update plan type in user_profiles table
                try:
                    supabase.table('user_profiles').update({
                        "plan_type": "starter" if credits == 50 else "pro" if credits == 120 else "creator" if credits == 280 else "contentMachine",
                        "updated_at": "now()"
                    }).eq('stripe_subscription_id', subscription_id).execute()
                    logger.info(f"Updated plan details for subscription {subscription_id}")
                except Exception as e:
                    logger.error(f"Error updating plan details: {e}")
        
        # IMPORTANT: Do NOT modify user credits when subscription is updated
        # Users keep their existing credits when changing plans
        
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
        # Get customer details from Stripe
        customer = stripe.Customer.retrieve(customer_id)
        customer_email = customer.email
        
        # Find user by email
        auth_response = supabase.auth.admin.list_users()
        user_id = None
        
        for user in auth_response:
            if user.email == customer_email:
                user_id = user.id
                break
        
        if user_id and subscription_id:
            # Map amount to credits for monthly allocation
            amount_to_credits = {
                4.99: 50,   # Starter plan
                9.99: 120,  # Pro plan
                19.99: 280, # Creator plan
                49.99: 800, # Content Machine plan
            }
            
            credits = amount_to_credits.get(amount_paid, 50)
            
            # Add monthly credits to user account
            credits_service = UserCreditsService()
            new_balance = await credits_service.add_credits(user_id, credits)
            logger.info(f"Added {credits} monthly credits. User {user_id} now has {new_balance} credits")
            
            # Update user profile with last payment info
            try:
                supabase.table('user_profiles').update({
                    "updated_at": "now()"
                }).eq('stripe_subscription_id', subscription_id).execute()
                logger.info(f"Updated user profile for subscription {subscription_id}")
            except Exception as e:
                logger.error(f"Error updating user profile: {e}")
        else:
            logger.warning(f"User not found for email: {customer_email} or no subscription ID")
            
    except Exception as e:
        logger.error(f"Error handling invoice payment: {e}")

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
        logger.info(f"User {user_id} has {current_credits} credits")
        
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
            "free": 10,
            "starter": 50,
            "pro": 120,
            "creator": 280,
            "contentMachine": 800
        }
        
        credits_per_month = plan_credits_map.get(plan, 10)
        
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
        "test_credits": 10,
        "note": "Use /subscription-status with authentication for real data"
    }
