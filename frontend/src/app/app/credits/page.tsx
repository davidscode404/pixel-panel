'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import StripeProvider from '@/components/stripe/StripeProvider';
import CreditsPurchase from '@/components/stripe/CreditsPurchase';
import { createClient } from '@/lib/supabase/client';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function CreditsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUserCredits = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first, but allow force refresh
      const cachedCredits = localStorage.getItem('userCredits');
      const cacheTimestamp = localStorage.getItem('userCreditsTimestamp');
      const now = Date.now();
      const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity;
      const cacheValid = cacheAge < 300000; // 5 minutes cache validity

      if (cachedCredits && !forceRefresh && cacheValid) {
        setCredits(parseInt(cachedCredits));
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_CREDITS), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }

      const data = await response.json();
      const creditsValue = data.credits || 0;
      setCredits(creditsValue);
      
      // Cache the credits
      localStorage.setItem('userCredits', creditsValue.toString());
      localStorage.setItem('userCreditsTimestamp', now.toString());
    } catch (error) {
      setCredits(0); // Default to 0 if fetch fails
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchUserCredits();
    }
  }, [user, fetchUserCredits]);

  const handlePurchaseSuccess = () => {
    // Force refresh credits after successful purchase
    fetchUserCredits(true);
  };

  if (loading) {
    return <LoadingSpinner message="Loading credits..." fullPage />;
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push('/app/profile')}
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
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              AI Panel Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 10 credits per panel</li>
              <li>• 6 panels = 60 credits</li>
              <li>• Includes context awareness</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Thumbnail Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 10 credits per thumbnail</li>
              <li>• 3:4 portrait format</li>
              <li>• Comic book cover style</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Voice Generation
            </h4>
            <ul className="space-y-1" style={{ color: 'var(--foreground-secondary)' }}>
              <li>• 1 credit per narration</li>
              <li>• High-quality AI voices</li>
              <li>• 10 narrations = 10 credits</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)' }}>
          <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            Example: Full Comic Creation
          </h4>
          <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            <p>• 6 AI panels: 60 credits</p>
            <p>• 1 thumbnail: 10 credits</p>
            <p>• 6 voice narrations: 6 credits</p>
            <p className="font-semibold mt-2" style={{ color: 'var(--accent)' }}>
              Total: 76 credits (~$0.76)
            </p>
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
