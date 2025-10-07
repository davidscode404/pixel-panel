# PixelPanel Subscription Features & Logic

## Overview

PixelPanel uses Stripe for subscription management with a credit-based system. Users purchase credits through subscription plans or one-time purchases, and credits are used to generate AI comics and voice narrations.

## Subscription Plans

### Plan Tiers

| Plan | Price | Monthly Credits | Features |
|------|-------|----------------|----------|
| **Free** | $0 | 100 | Basic comic generation, standard quality |
| **Starter** | $4.99 | 500 | High-quality generation, priority support |
| **Pro** | $9.99 | 1200 | Premium features, advanced voice, custom training |
| **Creator** | $19.99 | 2800 | All Pro features, enhanced capabilities |
| **Content Machine** | $49.99 | 8000 | Maximum credits, all premium features |

### Credit Usage

- **AI Panel Generation**: 10 credits per panel
- **Thumbnail Generation**: 10 credits per thumbnail
- **Voice Generation**: 1 credit per narration (10 narrations = 10 credits)

## Subscription Logic

### 1. Customer ID-Based User Matching

**Primary Method**: Users are identified by `stripe_customer_id` stored in the `user_profiles` table.

**Flow**:
1. Stripe webhook receives event with `customer_id`
2. System looks up user by `stripe_customer_id` in database
3. If not found, creates new user automatically
4. No email-based fallback (simplified approach)

### 2. Webhook Event Handling

#### `customer.subscription.created`
- **Trigger**: New subscription created
- **Action**: 
  - Find/create user by customer ID
  - Add initial monthly credits
  - Store subscription data in `user_profiles`
  - Set plan type and status

#### `customer.subscription.updated`
- **Trigger**: Plan changes, status updates
- **Action**:
  - Update subscription status in database
  - Update plan type
  - **No credits added** (credits only added on renewals)

#### `customer.subscription.deleted`
- **Trigger**: Subscription cancelled
- **Action**:
  - Mark subscription as cancelled
  - **User keeps all existing credits**

#### `invoice.payment_succeeded`
- **Trigger**: Monthly subscription renewal
- **Action**:
  - Add new monthly credits to existing balance
  - **Simple additive approach** - no limits or complex rollover

#### `checkout.session.completed`
- **Trigger**: One-time credit purchase
- **Action**:
  - Find/create user by customer ID
  - Add purchased credits to account

#### `payment_intent.succeeded`
- **Trigger**: PaymentIntent-based purchase
- **Action**:
  - Add credits based on package metadata

### 3. Credit Rollover Policy

**Simplified Additive Approach**:
- ✅ **Monthly Renewals**: New credits added to existing balance
- ✅ **Plan Upgrades**: User keeps all existing credits
- ✅ **Plan Downgrades**: User keeps all existing credits
- ✅ **Cancellations**: User keeps all existing credits
- ✅ **No Limits**: Users never lose credits they've paid for

**Example Scenarios**:

```
Monthly Renewal:
User has 300 credits → Gets 500 new credits → Total: 800 credits

Plan Upgrade (Starter to Pro):
User has 800 credits → No credits added during upgrade
Next renewal: 800 + 1200 = 2000 credits

Plan Downgrade (Pro to Starter):
User has 2000 credits → Keeps all 2000 credits
Next renewal: 2000 + 500 = 2500 credits

Cancellation:
User has 1500 credits → Keeps all 1500 credits
No new monthly credits until resubscription
```

## Database Schema

### `user_profiles` Table

```sql
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    credits INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_type TEXT DEFAULT 'free',
    status TEXT DEFAULT 'inactive',
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Key Fields:
- `stripe_customer_id`: Links user to Stripe customer
- `stripe_subscription_id`: Links to Stripe subscription
- `plan_type`: Current subscription plan
- `status`: Subscription status (active, cancelled, etc.)
- `credits`: Current credit balance

## API Endpoints

### Stripe Webhook
- **Endpoint**: `/api/stripe/webhook`
- **Method**: POST
- **Purpose**: Handle all Stripe events
- **Rate Limit**: 100/minute

### User Credits
- **Endpoint**: `/api/stripe/user-credits`
- **Method**: GET
- **Purpose**: Get current user's credit balance
- **Rate Limit**: 50/minute

### Subscription Status
- **Endpoint**: `/api/stripe/subscription-status`
- **Method**: GET
- **Purpose**: Get user's subscription details
- **Rate Limit**: 50/minute

### Payment Intent Creation
- **Endpoint**: `/api/stripe/create-payment-intent`
- **Method**: POST
- **Purpose**: Create Stripe PaymentIntent for credit purchases
- **Rate Limit**: 10/minute

## Error Handling

### Webhook Failures
- Invalid payload: Returns 400 error
- Invalid signature: Returns 400 error
- User not found: Logs warning, no credits added
- Database errors: Logs error, continues processing

### Credit Operations
- Failed credit addition: Logs error, doesn't raise exception
- Database connection issues: Logs error, returns fallback values
- User profile creation: Automatic retry with error logging

## Security Features

### Webhook Verification
- Stripe signature verification using `STRIPE_WEBHOOK_SECRET`
- Payload validation before processing
- Rate limiting on all endpoints

### User Authentication
- JWT token validation for API endpoints
- Supabase auth integration
- User ID verification for all operations

## Testing

### Local Testing
- Use Stripe CLI to forward webhooks to local server
- Test webhook endpoint: `http://localhost:4242/webhook`
- Trigger test events: `stripe trigger payment_intent.succeeded`

### Test Server
- Flask-based test server in `stripe_test/` folder
- Uses actual webhook logic from `stripe.py`
- Real database operations for comprehensive testing

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

## Monitoring & Logging

### Key Log Events
- Subscription creation/updates
- Credit additions and balances
- User creation via Stripe
- Webhook processing status
- Error conditions and fallbacks

### Metrics to Track
- Subscription conversion rates
- Credit usage patterns
- Webhook success/failure rates
- User creation via Stripe vs. direct signup

## Future Enhancements

### Potential Features
- Credit expiration policies
- Usage analytics and reporting
- Automated subscription management
- Credit gifting and sharing
- Bulk credit purchases
- Enterprise pricing tiers

### Technical Improvements
- Webhook retry mechanisms
- Enhanced error recovery
- Real-time credit balance updates
- Subscription analytics dashboard
- Automated testing suite
