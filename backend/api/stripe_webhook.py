from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import stripe
import os
import json
from services.user_credits import UserCreditsService

router = APIRouter()

# Initialize Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

@router.post('/stripe/webhook')
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle successful payment
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        await handle_successful_payment(session)
    
    # Handle subscription creation
    elif event['type'] == 'customer.subscription.created':
        subscription = event['data']['object']
        await handle_subscription_created(subscription)
    
    # Handle subscription updates
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        await handle_subscription_updated(subscription)
    
    # Handle subscription cancellation
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        await handle_subscription_cancelled(subscription)

    return JSONResponse({"status": "success"})

async def handle_successful_payment(session):
    """Handle successful one-time payment"""
    customer_id = session.get('customer')
    metadata = session.get('metadata', {})
    user_id = metadata.get('user_id')
    package_id = metadata.get('package_id')
    
    if not user_id or not package_id:
        print(f"Missing user_id or package_id in session metadata: {metadata}")
        return
    
    # Map package IDs to credit amounts
    credit_map = {
        'credits_50': 50,
        'credits_120': 120,
        'credits_280': 280,
        'credits_800': 800
    }
    
    credits_to_add = credit_map.get(package_id, 0)
    
    if credits_to_add > 0:
        user_credits_service = UserCreditsService()
        await user_credits_service.add_credits(user_id, credits_to_add)
        print(f"Added {credits_to_add} credits to user {user_id}")

async def handle_subscription_created(subscription):
    """Handle new subscription creation"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    
    # You can store subscription info in your database here
    print(f"New subscription created: {subscription_id} for customer {customer_id}")

async def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    status = subscription.get('status')
    
    print(f"Subscription {subscription_id} updated to status: {status}")
    # Note: Do NOT modify user credits when subscription is updated
    # Users keep their existing credits when changing plans

async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    customer_id = subscription.get('customer')
    subscription_id = subscription.get('id')
    
    print(f"Subscription {subscription_id} cancelled for customer {customer_id}")
