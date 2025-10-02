'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import StripeProvider from '@/components/stripe/StripeProvider';
import CreditsPurchase from '@/components/stripe/CreditsPurchase';
import { createClient } from '@/lib/supabase/client';

export default function CreditsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchUserCredits();
    }
  }, [user]);

  const fetchUserCredits = async () => {
    try {
      // TODO: Replace with actual credits fetching from your database
      // For now, we'll simulate with a default value
      setCredits(10); // Default credits
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSuccess = () => {
    // Refresh credits after successful purchase
    fetchUserCredits();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push('/protected/profile')}
          className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:opacity-80"
          style={{
            color: 'var(--foreground-secondary)',
            backgroundColor: 'var(--background-secondary)',
          }}
        >
          <span>←</span>
          <span>Back to Profile</span>
        </button>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
          Credits & Billing
        </h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>
          Purchase credits to generate comics and voice narrations
        </p>
      </div>
      
      {/* Current Credits Display */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-full font-bold text-3xl" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground-on-accent)' }}>
            {credits}
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
      </div>

      {/* Credits Usage Info */}
      <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          How Credits Work
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Comic Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 1 credit per panel generation</li>
              <li>• 6 panels = 6 credits per comic</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Voice Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 2 credits per voice scene</li>
              <li>• High-quality AI voices</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Purchase Credits */}
      <StripeProvider>
        <CreditsPurchase onSuccess={handlePurchaseSuccess} />
      </StripeProvider>
    </div>
  );
}
