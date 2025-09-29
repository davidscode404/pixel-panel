'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import StripeProvider from '@/components/stripe/StripeProvider';
import CreditsPurchase from '@/components/stripe/CreditsPurchase';
import { createClient } from '@/lib/supabase/client';

export default function CreditsPage() {
  const { user } = useAuth();
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
    <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800">
      <div className="container mx-auto px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-amber-50 mb-8">Credits & Billing</h1>
          
          {/* Current Credits Display */}
          <div className="bg-stone-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-amber-400 mb-4">Your Credits</h2>
            <div className="flex items-center space-x-4">
              <div className="text-6xl text-amber-400">🪙</div>
              <div>
                <div className="text-4xl font-bold text-white">{credits}</div>
                <div className="text-stone-400">Available Credits</div>
              </div>
            </div>
          </div>

          {/* Credits Usage Info */}
          <div className="bg-stone-800 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-amber-400 mb-4">How Credits Work</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-2">Comic Generation</h4>
                <ul className="text-stone-300 space-y-1">
                  <li>• 1 credit per panel generation</li>
                  <li>• 6 panels = 6 credits per comic</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Voice Generation</h4>
                <ul className="text-stone-300 space-y-1">
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
      </div>
    </div>
  );
}
