'use client';

import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';

interface StripeProviderProps {
  children: React.ReactNode;
}

export default function StripeProvider({ children }: StripeProviderProps) {
  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
