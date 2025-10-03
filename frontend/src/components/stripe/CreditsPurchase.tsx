'use client';

import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import { buildApiUrl, API_CONFIG } from '@/config/api';

interface CreditsPurchaseProps {
  onSuccess?: () => void;
}

const CREDIT_PACKAGES = [
  { id: 'credits_50', name: 'Starter', price: 4.99, credits: 50, popular: false, description: 'Perfect for trying out' },
  { id: 'credits_120', name: 'Popular', price: 9.99, credits: 120, popular: true, description: 'Most popular choice' },
  { id: 'credits_280', name: 'Pro', price: 19.99, credits: 280, popular: false, description: 'For regular creators' },
  { id: 'credits_800', name: 'Creator', price: 49.99, credits: 800, popular: false, description: 'For power users' },
];

export default function CreditsPurchase({ onSuccess }: CreditsPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();
  const supabase = createClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user and session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Please sign in to purchase credits');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      // Create payment intent on FastAPI backend
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CREATE_PAYMENT_INTENT), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          userId: user.id,
        }),
      });

      const { clientSecret, error: paymentError } = await response.json();

      if (paymentError) {
        throw new Error(paymentError);
      }

      // Confirm the payment
      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Success!
      setSuccess(true);
      setError(null);
      
      // Wait a moment before calling onSuccess to show the success message
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-8 rounded-lg border" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Purchase Credits
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--success)', color: 'white' }}>
            <span>Secure Payment</span>
          </div>
        </div>
        
        {/* Credit Packages */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className="relative p-4 rounded-lg border-2 transition-all hover:shadow-lg"
              style={{
                borderColor: selectedPackage.id === pkg.id ? 'var(--accent)' : 'var(--border)',
                backgroundColor: selectedPackage.id === pkg.id ? 'var(--background-secondary)' : 'var(--background)',
              }}
            >
              {pkg.popular && (
                <div 
                  className="absolute -top-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground-on-accent)' }}
                >
                  POPULAR
                </div>
              )}
              <div className="text-center">
                <div className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
                  {pkg.name}
                </div>
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--accent)' }}>
                  ${pkg.price}
                </div>
                <div className="text-sm mb-2" style={{ color: 'var(--foreground-secondary)' }}>
                  {pkg.credits} credits
                </div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {pkg.description}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
                  ${(pkg.price / pkg.credits).toFixed(3)} per credit
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
              Card Information
            </label>
            <div className="p-3 rounded border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#0f172a', // Will work in light mode
                      '::placeholder': {
                        color: '#64748b',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                  hidePostalCode: true,
                }}
              />
            </div>
          </div>

          {success && (
            <div className="p-3 rounded-lg border animate-pulse" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)', color: 'var(--success)' }}>
              <div className="text-sm font-semibold">
                Payment successful! Your credits will be added shortly.
              </div>
            </div>
          )}

          {error && !success && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)', color: 'var(--error)' }}>
              <div className="text-sm">{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || loading || success}
            className="w-full py-4 px-6 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-on-accent)',
            }}
          >
            {loading ? (
              'Processing...'
            ) : success ? (
              'Payment Successful!'
            ) : (
              `Pay $${selectedPackage.price} - Get ${selectedPackage.credits} Credits`
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
    </div>
  );
}
