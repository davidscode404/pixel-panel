'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildApiUrl, API_CONFIG } from '@/config/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchUserCredits = useCallback(async () => {
    try {
      setLoading(true);
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
      setCredits(data.credits || 0);
    } catch (error) {
      setCredits(0); // Default to 0 if fetch fails
    } finally {
      setLoading(false);
    }
  }, [supabase])

  useEffect(() => {
    if (user) {
      fetchUserCredits()
    }
  }, [user, fetchUserCredits])

  if (loading) {
    return <LoadingSpinner message="Loading profile..." fullPage />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Profile</h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>Manage your account settings</p>
      </div>

      {/* Credits Section */}
      <div className="p-6 rounded-lg border mb-6" style={{ backgroundColor: 'transparent', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full font-bold text-2xl" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground-on-accent)' }}>
              {credits !== null ? credits : '0'}
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                Credits Available
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                For comic and voice generation
              </p>
              <div className="mt-2 flex gap-4 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                <span>1 credit per panel</span>
                <span>•</span>
                <span>1 credit per thumbnail</span>
                <span>•</span>
                <span>1 credit per voice narration</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/protected/credits')}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-on-accent)'
            }}
          >
            Purchase Credits
          </button>
        </div>
        
        {/* Credit Usage Examples */}
        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'transparent' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            Common Operations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
            <div className="flex justify-between">
              <span>Single panel generation</span>
              <span className="font-medium">1 credit</span>
            </div>
            <div className="flex justify-between">
              <span>Comic thumbnail</span>
              <span className="font-medium">1 credit</span>
            </div>
            <div className="flex justify-between">
              <span>Voice narration</span>
              <span className="font-medium">1 credit</span>
            </div>
            <div className="flex justify-between">
              <span>Full comic (6 panels + thumbnail + 6 narrations)</span>
              <span className="font-medium">13 credits</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-lg border" style={{ backgroundColor: 'transparent', borderColor: 'var(--border)' }}>
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <span className="text-2xl font-bold" style={{ color: 'var(--foreground-on-accent)' }}>
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Account Information</h2>
            <p style={{ color: 'var(--foreground-secondary)' }}>{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border rounded-md"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--foreground-secondary)'
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Member Since
            </label>
            <input
              type="text"
              value={user?.user_metadata?.created_at ? new Date(user.user_metadata.created_at as string).toLocaleDateString() : 'Unknown'}
              disabled
              className="w-full px-3 py-2 border rounded-md"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--foreground-secondary)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
