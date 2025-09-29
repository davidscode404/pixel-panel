'use client';

import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';

interface CreditsPurchaseProps {
  onSuccess?: () => void;
}

const CREDIT_PACKAGES = [
  { id: 'credits_10', name: '10 Credits', price: 5, credits: 10, popular: false },
  { id: 'credits_25', name: '25 Credits', price: 10, credits: 25, popular: true },
  { id: 'credits_50', name: '50 Credits', price: 18, credits: 50, popular: false },
  { id: 'credits_100', name: '100 Credits', price: 30, credits: 100, popular: false },
];

export default function CreditsPurchase({ onSuccess }: CreditsPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Please sign in to purchase credits');
      }

      // Create payment intent on your backend
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-stone-800 rounded-lg">
      <h2 className="text-2xl font-bold text-amber-50 mb-6">Purchase Credits</h2>
      
      {/* Credit Packages */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {CREDIT_PACKAGES.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg)}
            className={`p-3 rounded-lg border-2 transition-colors ${
              selectedPackage.id === pkg.id
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-stone-600 hover:border-stone-500'
            } ${pkg.popular ? 'ring-2 ring-amber-500' : ''}`}
          >
            {pkg.popular && (
              <div className="text-xs text-amber-400 font-semibold mb-1">POPULAR</div>
            )}
            <div className="text-white font-semibold">{pkg.name}</div>
            <div className="text-amber-400 font-bold">${pkg.price}</div>
            <div className="text-xs text-stone-400">{pkg.credits} credits</div>
          </button>
        ))}
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 bg-stone-700 rounded-lg">
          <label className="block text-sm font-medium text-stone-300 mb-2">
            Card Information
          </label>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#ffffff',
                  '::placeholder': {
                    color: '#a78bfa',
                  },
                },
                invalid: {
                  color: '#ef4444',
                },
              },
            }}
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || loading}
          className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : `Pay $${selectedPackage.price}`}
        </button>
      </form>

      <div className="mt-4 text-xs text-stone-400 text-center">
        Secure payment powered by Stripe
      </div>
    </div>
  );
}
