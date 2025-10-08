'use client';

import { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import { buildApiUrl } from '@/config/api';

interface CreditsPurchaseProps {
  onSuccess?: () => void;
  selectedPackage?: string;
}

const CREDIT_PACKAGES = [
  { id: 'credits_500', name: 'Starter', price: 4.99, credits: 500, popular: false, description: 'Perfect for trying out' },
  { id: 'credits_1200', name: 'Pro', price: 9.99, credits: 1200, popular: true, description: 'Most popular choice' },
  { id: 'credits_2800', name: 'Creator', price: 19.99, credits: 2800, popular: false, description: 'For regular creators' },
  { id: 'credits_8000', name: 'Content Machine', price: 49.99, credits: 8000, popular: false, description: 'For large-scale content creation' },
];

export default function CreditsPurchase({ selectedPackage: initialSelectedPackage }: CreditsPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState(() => {
    if (initialSelectedPackage) {
      return CREDIT_PACKAGES.find(pkg => pkg.id === initialSelectedPackage) || CREDIT_PACKAGES[1];
    }
    return CREDIT_PACKAGES[1];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const stripe = useStripe();
  const supabase = createClient();

  // Update selected package when prop changes
  useEffect(() => {
    if (initialSelectedPackage) {
      const packageToSelect = CREDIT_PACKAGES.find(pkg => pkg.id === initialSelectedPackage);
      if (packageToSelect) {
        setSelectedPackage(packageToSelect);
      }
    }
  }, [initialSelectedPackage]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      // Get access token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Please log in to subscribe');
        setLoading(false);
        return;
      }

      // Map credit package IDs to plan IDs
      const packageToPlanMap: { [key: string]: string } = {
        'credits_500': 'starter',
        'credits_1200': 'pro',
        'credits_2800': 'creator',
        'credits_8000': 'content_machine'
      };

      const planId = packageToPlanMap[selectedPackage.id];
      if (!planId) {
        setError('Invalid plan selected');
        setLoading(false);
        return;
      }

      // Create checkout session via backend API
      const response = await fetch(buildApiUrl('/api/stripe/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: planId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;

    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start checkout process');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 rounded-lg border" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--foreground)' }}>
          Upgrade Your Plan
        </h3>
        <p className="text-center mb-8 text-lg" style={{ color: 'var(--foreground-secondary)' }}>
          Get more credits and premium features with our billing plans
        </p>
        
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--success)', color: 'white' }}>
            <span>Secure Payment</span>
          </div>
        </div>
        
        {/* Credit Packages */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative p-6 rounded-2xl border-2 transition-all duration-200 hover:shadow-xl hover:scale-105 ${
                pkg.popular ? 'ring-2 ring-orange-500/20' : ''
              }`}
              style={{
                borderColor: selectedPackage.id === pkg.id ? 'var(--accent)' : pkg.popular ? '#f97316' : 'var(--border)',
                backgroundColor: selectedPackage.id === pkg.id ? 'var(--background-secondary)' : pkg.popular ? 'rgba(249, 115, 22, 0.05)' : 'var(--background)',
              }}
            >
              {pkg.popular && (
                <div 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow-lg"
                  style={{ backgroundColor: '#f97316', color: 'white' }}
                >
                  MOST POPULAR
                </div>
              )}
              <div className="text-center">
                <div className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
                  {pkg.name}
                </div>
                <div className="text-3xl font-bold mb-2" style={{ color: pkg.popular ? '#f97316' : 'var(--accent)' }}>
                  ${pkg.price}
                  <span className="text-lg font-normal ml-1" style={{ color: 'var(--foreground-secondary)' }}>/month</span>
                </div>
                <div className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  {pkg.credits} credits
                </div>
                <div className="text-sm mb-3" style={{ color: 'var(--foreground-secondary)' }}>
                  {pkg.description}
                </div>
                <div className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--background-secondary)', color: 'var(--foreground-muted)' }}>
                  ${(pkg.price / pkg.credits).toFixed(3)} per credit
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {error && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)', color: 'var(--error)' }}>
              <div className="text-sm">{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || loading}
            className="w-full py-4 px-6 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-on-accent)',
            }}
          >
            {loading ? (
              'Redirecting to Checkout...'
            ) : (
              `Subscribe $${selectedPackage.price}/month - ${selectedPackage.credits} Credits`
            )}
          </button>
        </form>

        {/* Security Badges */}
        <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            <span>SSL Encrypted</span>
            <span>•</span>
            <span>PCI Compliant</span>
            <span>•</span>
            <span>Powered by Stripe</span>
          </div>
        </div>
    </div>
  );
}
