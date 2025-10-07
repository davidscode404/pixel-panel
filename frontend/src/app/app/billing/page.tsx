'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StripeProvider from '@/components/stripe/StripeProvider';
import CreditsPurchase from '@/components/stripe/CreditsPurchase';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  popular?: boolean;
}

interface SubscriptionStatus {
  plan: string;
  status: string;
  credits: number;
  next_billing_date?: string;
}

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    credits: 10,
    features: [
      '10 credits per month',
      'Basic comic generation',
      'Voice generation',
      'Standard image quality',
      'Community support'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 4.99,
    credits: 50,
    features: [
      '50 credits per month',
      'High-quality comic generation',
      'High-quality voice generation',
      'Priority support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19.99,
    credits: 280,
    popular: true,
    features: [
      '280 credits per month',
      'Premium comic generation',
      'Advanced voice features',
      'Custom character training',
      'Priority support'
    ]
  },
  {
    id: 'creator',
    name: 'Creator',
    price: 49.99,
    credits: 800,
    features: [
      '800 credits per month',
      'Premium comic generation',
      'Advanced voice features',
      'Custom character training',
      'Priority support'
    ]
  }
];

export default function BillingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string>('credits_120'); // Default to pro plan
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchCurrentPlan();
    }
  }, [user]);

  const fetchCurrentPlan = async () => {
    console.log('🔍 fetchCurrentPlan called');
    try {
      if (!user) {
        console.log('❌ No user found - setting to free plan');
        setCurrentPlan('free');
        return;
      }
      console.log('✅ User found:', user.email);
      
      // Get access token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('❌ No session token - setting to free plan');
        setCurrentPlan('free');
        return;
      }
      console.log('✅ Session token found');

      // Fetch subscription status from backend
      console.log('🌐 Making API call to:', buildApiUrl(API_CONFIG.ENDPOINTS.STRIPE_SUBSCRIPTION_STATUS));
      const subscriptionResponse = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.STRIPE_SUBSCRIPTION_STATUS), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      console.log('📡 Response status:', subscriptionResponse.status);

      if (subscriptionResponse.ok) {
        const status: SubscriptionStatus = await subscriptionResponse.json();
        console.log('📊 Subscription status response:', status);
        setSubscriptionStatus(status);
        setCurrentPlan(status.plan);
      } else {
        // Fallback to free plan if API fails
        setCurrentPlan('free');
      }

      // Fetch credits data
      const creditsResponse = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_CREDITS), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json();
        setCredits(creditsData.credits || 0);
      } else {
        setCredits(0);
      }
    } catch (error) {
      console.error('Error fetching current plan:', error);
      setCurrentPlan('free');
      setCredits(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (planId === 'free') {
      // Handle free plan
      console.log('Selected free plan');
      return;
    }

    // For paid plans, we'll use the Stripe integration
    // Map plan IDs to credit package IDs for the payment system
    const planToPackageMap = {
      starter: 'credits_50',
      pro: 'credits_120',
      creator: 'credits_280',
      contentMachine: 'credits_800'
    };

    const packageId = planToPackageMap[planId as keyof typeof planToPackageMap];
    if (packageId) {
      // Set the selected package for the payment form
      setSelectedPackage(packageId);
      // Scroll to the payment section
      document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePurchaseSuccess = () => {
    // Refresh credits after successful purchase
    fetchCurrentPlan();
    
    // Show success message
    alert('Payment successful! Your credits have been added to your account.');
  };

  if (loading) {
    return <LoadingSpinner message="Loading billing information..." fullPage />;
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
          Billing & Payments
        </h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>
          Manage your billing and payment preferences
        </p>
      </div>

      {/* Credits Section */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full font-bold text-3xl" style={{ backgroundColor: '#f97316', color: 'white' }}>
              {credits !== null ? credits : '0'}
            </div>
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                Available Credits
              </div>
              <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Use credits to generate comics and voice narrations
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/app/credits')}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-on-accent)'
            }}
          >
            Purchase Credits
          </button>
        </div>
      </div>

      {/* Current Plan Status */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Current Plan</h2>
            <p style={{ color: 'var(--foreground-secondary)' }}>You're currently on the {subscriptionPlans.find(p => p.id === currentPlan)?.name} plan</p>
            {subscriptionStatus?.status && (
              <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>Status: {subscriptionStatus.status}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
              ${subscriptionPlans.find(p => p.id === currentPlan)?.price}/month
            </div>
            <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              {subscriptionStatus?.credits || subscriptionPlans.find(p => p.id === currentPlan)?.credits} credits
            </div>
            {subscriptionStatus?.next_billing_date && (
              <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                Next billing: {new Date(subscriptionStatus.next_billing_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Your Plan Section */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--foreground)' }}>
          Upgrade Your Plan
        </h3>
        <p className="text-center mb-8 text-lg" style={{ color: 'var(--foreground-secondary)' }}>
          Get more credits and premium features with our billing plans
        </p>
        
        <StripeProvider>
          <CreditsPurchase onSuccess={handlePurchaseSuccess} selectedPackage={selectedPackage} />
        </StripeProvider>
      </div>

      {/* Features Comparison */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--foreground)' }}>
          Everything you need to create amazing comics
        </h3>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>AI Comic Generation</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Create stunning comics with advanced AI that understands your story and brings it to life
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Voice Generation</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Add realistic voiceovers to your comics with high-quality AI voice synthesis
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Export & Share</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Export your creations in multiple formats and share them with the world
            </p>
          </div>
        </div>
      </div>

      {/* How Credits Work Section */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
          How Credits Work
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              AI Panel Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 1 credit per panel</li>
              <li>• 6 panels = 6 credits</li>
              <li>• Includes context awareness</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Thumbnail Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 1 credit per thumbnail</li>
              <li>• 3:4 portrait format</li>
              <li>• Comic book cover style</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Voice Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 0.1 credits per narration</li>
              <li>• High-quality AI voices</li>
              <li>• 10 narrations = 1 credit</li>
            </ul>
          </div>
        </div>
        
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)' }}>
          <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            Example: Full Comic Creation
          </h4>
          <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            <p>• 6 AI panels: 6 credits</p>
            <p>• 1 thumbnail: 1 credit</p>
            <p>• 6 voice narrations: 0.6 credits</p>
            <p className="font-semibold mt-2" style={{ color: 'var(--accent)' }}>
              Total: 7.6 credits (~$0.76)
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--foreground)' }}>
          Frequently Asked Questions
        </h3>
        
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>What happens to unused credits?</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Unused credits are always preserved and added to your account. When your subscription renews each month, you get a new allotment of credits that are added to your existing balance. You never lose credits you've paid for.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>What happens when I upgrade my plan?</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              When you upgrade your plan, you keep all your existing credits. Your new monthly credit allotment will be added to your current balance starting from your next billing cycle.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Can I change my plan anytime?</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any differences.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>What happens if I downgrade or cancel?</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              If you downgrade or cancel your subscription, you keep all your existing credits and can continue using them. However, you won't receive new monthly credit allotments until you resubscribe.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Do you offer refunds?</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, contact our support team.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Is there a free trial?</h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Yes! Start with our free plan that includes 10 credits to try out our features. No credit card required.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
