'use client';

import { useState } from 'react';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { createClient } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface SubscriptionManagementProps {
  currentPlan: string;
  subscriptionStatus: {
    plan: string;
    status: string;
    credits: number;
    next_billing_date?: string;
    subscription_id?: string;
  } | null;
  onPlanChange: () => void;
}

export default function SubscriptionManagement({ 
  currentPlan, 
  subscriptionStatus, 
  onPlanChange 
}: SubscriptionManagementProps) {
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleCancelSubscription = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANCEL_SUBSCRIPTION), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Your subscription will be cancelled at the end of the current billing period. You will retain access to premium features until then.');
        setShowCancelDialog(false);
        onPlanChange(); // Refresh subscription status
      } else {
        setError(result.detail || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SUBSCRIPTION_PORTAL), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.portal_url) {
        window.open(result.portal_url, '_blank');
      } else {
        setError('Failed to open subscription portal. Please try again.');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      setError('Failed to open subscription portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async (newPlanId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.UPDATE_SUBSCRIPTION), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: newPlanId }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`Subscription updated to ${newPlanId} plan successfully! Your existing credits have been preserved.`);
        setShowChangeDialog(false);
        onPlanChange(); // Refresh subscription status
      } else {
        setError(result.detail || 'Failed to update subscription');
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      setError('Failed to update subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const planNames = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    creator: 'Creator',
    contentMachine: 'Content Machine'
  };

  if (currentPlan === 'free') {
    return null; // Don't show management options for free plan
  }

  return (
    <div className="p-6 rounded-lg border mb-8" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
      <h3 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
        Manage Subscription
      </h3>
      
      {message && (
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground-on-accent)' }}>
          {message}
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/20 text-red-600 border border-red-500/30">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)' }}>
          <div>
            <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Current Plan: {planNames[currentPlan as keyof typeof planNames]}
            </h4>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Status: {subscriptionStatus?.status || 'Active'}
            </p>
            {subscriptionStatus?.next_billing_date && (
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Next billing: {new Date(subscriptionStatus.next_billing_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setShowChangeDialog(true)}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-on-accent)'
            }}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Change Plan'}
          </button>

          <button
            onClick={handleOpenPortal}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-50 border"
            style={{
              color: 'var(--foreground)',
              borderColor: 'var(--border)'
            }}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Manage Billing'}
          </button>

          <button
            onClick={() => setShowCancelDialog(true)}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-50 text-red-600 border border-red-500/30 hover:bg-red-500/10"
          >
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Change Plan Dialog */}
      <ConfirmDialog
        isOpen={showChangeDialog}
        onClose={() => setShowChangeDialog(false)}
        onConfirm={() => {}} // Will be handled by individual plan buttons
        title="Change Subscription Plan"
        message="Select a new plan. Your existing credits will be preserved when you change plans."
        confirmText=""
        showCancelButton={false}
      >
        <div className="space-y-3 mt-4">
          {/* Credit preservation notice */}
          <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-700 font-medium">
                Your current credits will be preserved when changing plans
              </span>
            </div>
          </div>
          {Object.entries(planNames).map(([planId, planName]) => {
            if (planId === 'free' || planId === currentPlan) return null;
            
            return (
              <button
                key={planId}
                onClick={() => handleChangePlan(planId)}
                disabled={loading}
                className="w-full p-3 rounded-lg border text-left transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background-secondary)'
                }}
              >
                <div className="font-semibold">{planName}</div>
                <div className="text-sm opacity-75">Switch to {planName} plan</div>
              </button>
            );
          })}
        </div>
      </ConfirmDialog>

      {/* Cancel Subscription Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelSubscription}
        title="Cancel Subscription"
        message="Are you sure you want to cancel your subscription? You'll retain access to premium features until the end of your current billing period."
        confirmText="Cancel Subscription"
        confirmButtonStyle="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
